// CI test launcher only. No privileges, policies, accounts or app permissions are added.
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

namespace FolioNativeSmoke {
  public sealed class TokenFacts {
    public bool Elevated;
    public int ElevationType;
    public int IntegrityRid;
    public bool AdministratorsEnabled;
    public bool AdministratorsDenyOnly;
    public bool SameUser;
  }

  public sealed class RestrictedProcess : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr Sid; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
      public int cb; public string reserved; public string desktop; public string title;
      public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort showWindow,reserved2;
      public IntPtr reservedPointer,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [StructLayout(LayoutKind.Sequential)] struct JobBasicLimits {
      public long processTime,jobTime; public uint flags; public UIntPtr minWorkingSet,maxWorkingSet;
      public uint activeProcesses; public UIntPtr affinity; public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct JobLimits {
      public JobBasicLimits basic; public IoCounters io;
      public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory;
    }
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", EntryPoint="CreateJobObjectW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref JobLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr data, int size, out int needed);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool SetTokenInformation(IntPtr token, int kind, IntPtr data, int size);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool CreateRestrictedToken(IntPtr token, uint flags,
      uint disabledCount, [In] SidAttributes[] disabled, uint deletedCount, IntPtr deleted,
      uint restrictedCount, IntPtr restricted, out IntPtr newToken);
    [DllImport("advapi32.dll", EntryPoint="CreateProcessAsUserW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool CreateProcessAsUser(IntPtr token, string app, StringBuilder command, IntPtr processAttributes,
      IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory,
      ref StartupInfo startup, out ProcessInfo process);

    IntPtr current, restricted, process, job;
    string user;
    public TokenFacts Parent { get; private set; }
    public TokenFacts Reduced { get; private set; }
    public TokenFacts Child { get; private set; }
    public uint Pid { get; private set; }

    static void Check(bool ok, string operation) {
      if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }
    static IntPtr ReadInfo(IntPtr token, int kind) {
      int size;
      GetTokenInformation(token, kind, IntPtr.Zero, 0, out size);
      if (size <= 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "GetTokenInformation size " + kind);
      IntPtr data = Marshal.AllocHGlobal(size);
      try { Check(GetTokenInformation(token, kind, data, size, out size), "GetTokenInformation " + kind); return data; }
      catch { Marshal.FreeHGlobal(data); throw; }
    }
    static int ReadNumber(IntPtr token, int kind) {
      IntPtr data=ReadInfo(token,kind);
      try { return Marshal.ReadInt32(data); } finally { Marshal.FreeHGlobal(data); }
    }
    static string ReadSid(IntPtr token, int kind) {
      IntPtr data=ReadInfo(token,kind);
      try { return new SecurityIdentifier(Marshal.ReadIntPtr(data)).Value; } finally { Marshal.FreeHGlobal(data); }
    }
    static TokenFacts Inspect(IntPtr token, string user) {
      string integrity=ReadSid(token,25);
      var facts=new TokenFacts { Elevated=ReadNumber(token,20)!=0, ElevationType=ReadNumber(token,18),
        IntegrityRid=int.Parse(integrity.Substring(integrity.LastIndexOf('-')+1)), SameUser=ReadSid(token,1)==user };
      IntPtr groups=ReadInfo(token,2);
      try {
        int count=Marshal.ReadInt32(groups), offset=IntPtr.Size==8 ? 8 : 4, stride=Marshal.SizeOf(typeof(SidAttributes));
        for (int i=0;i<count;i++) {
          var entry=(SidAttributes)Marshal.PtrToStructure(IntPtr.Add(groups,offset+i*stride),typeof(SidAttributes));
          if (new SecurityIdentifier(entry.Sid).IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid)) {
            facts.AdministratorsEnabled=(entry.Attributes&4)!=0;
            facts.AdministratorsDenyOnly=(entry.Attributes&16)!=0;
          }
        }
      } finally { Marshal.FreeHGlobal(groups); }
      return facts;
    }
    static void RequireLimited(TokenFacts facts) {
      if (facts.Elevated || facts.IntegrityRid!=8192 || facts.AdministratorsEnabled || !facts.SameUser)
        throw new InvalidOperationException("Refusing launch: expected same-user non-elevated Medium token; actual Elevated="+facts.Elevated+
          ", IntegrityRid="+facts.IntegrityRid+", AdministratorsEnabled="+facts.AdministratorsEnabled+", SameUser="+facts.SameUser);
    }
    static IntPtr SidBytes(string value, out int length) {
      var sid=new SecurityIdentifier(value); byte[] bytes=new byte[sid.BinaryLength]; sid.GetBinaryForm(bytes,0);
      length=bytes.Length; IntPtr pointer=Marshal.AllocHGlobal(length); Marshal.Copy(bytes,0,pointer,length); return pointer;
    }
    public static TokenFacts CurrentToken() {
      IntPtr token; Check(OpenProcessToken(GetCurrentProcess(),8,out token),"OpenProcessToken diagnostic");
      try { return Inspect(token,ReadSid(token,1)); } finally { CloseHandle(token); }
    }
    public RestrictedProcess() {
      try {
        // QUERY | DUPLICATE | ASSIGN_PRIMARY | ADJUST_DEFAULT, never adjust caller privileges.
        Check(OpenProcessToken(GetCurrentProcess(),0x8b,out current),"OpenProcessToken current");
        user=ReadSid(current,1); Parent=Inspect(current,user);
        int ignored; IntPtr admin=SidBytes("S-1-5-32-544",out ignored);
        try {
          // DISABLE_MAX_PRIVILEGE (1) + LUA_TOKEN (4). Never SANDBOX_INERT (2).
          Check(CreateRestrictedToken(current,5,1,new [] { new SidAttributes { Sid=admin,Attributes=0 } },
            0,IntPtr.Zero,0,IntPtr.Zero,out restricted),"CreateRestrictedToken LUA/deny-only Administrators");
        } finally { Marshal.FreeHGlobal(admin); }
        var medium=new SecurityIdentifier("S-1-16-8192"); int header=Marshal.SizeOf(typeof(SidAttributes));
        IntPtr label=Marshal.AllocHGlobal(header+medium.BinaryLength);
        try {
          byte[] sid=new byte[medium.BinaryLength]; medium.GetBinaryForm(sid,0);
          IntPtr address=IntPtr.Add(label,header); Marshal.Copy(sid,0,address,sid.Length);
          Marshal.StructureToPtr(new SidAttributes { Sid=address, Attributes=0x20 },label,false);
          Check(SetTokenInformation(restricted,25,label,header+sid.Length),"SetTokenInformation Medium integrity");
        } finally { Marshal.FreeHGlobal(label); }
        Reduced=Inspect(restricted,user); RequireLimited(Reduced);
        if (Parent.AdministratorsEnabled && !Reduced.AdministratorsDenyOnly)
          throw new InvalidOperationException("Administrators SID was not reduced to deny-only.");
      } catch { Dispose(); throw; }
    }
    public void Launch(string executable, string directory) {
      if (process!=IntPtr.Zero) throw new InvalidOperationException("Only one owned child is allowed.");
      job=CreateJobObject(IntPtr.Zero,null);
      if (job==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(),"CreateJobObject");
      var limits=new JobLimits { basic=new JobBasicLimits { flags=0x2000 } }; // KILL_ON_JOB_CLOSE
      Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(JobLimits))),"SetInformationJobObject kill-on-close");
      var startup=new StartupInfo { cb=Marshal.SizeOf(typeof(StartupInfo)), flags=1, showWindow=0 };
      ProcessInfo child;
      // Explicit app path; no inherited handles; own environment; suspended until actual token verified.
      Check(CreateProcessAsUser(restricted,executable,new StringBuilder("\""+executable+"\""),IntPtr.Zero,
        IntPtr.Zero,false,0x08000004,IntPtr.Zero,directory,ref startup,out child),"CreateProcessAsUser restricted child");
      process=child.process; Pid=child.pid;
      try {
        // Closing the helper, including any exception, kills only this assigned child tree.
        Check(AssignProcessToJobObject(job,process),"AssignProcessToJobObject owned child");
        IntPtr token;
        Check(OpenProcessToken(process,8,out token),"OpenProcessToken child");
        try { Child=Inspect(token,user); RequireLimited(Child); } finally { CloseHandle(token); }
        if (ResumeThread(child.thread)==0xffffffff) throw new Win32Exception(Marshal.GetLastWin32Error(),"ResumeThread");
      } catch { TerminateProcess(process,1); throw; }
      finally { CloseHandle(child.thread); }
    }
    public bool Wait(uint milliseconds) {
      uint value=WaitForSingleObject(process,milliseconds);
      if (value==0xffffffff) throw new Win32Exception(Marshal.GetLastWin32Error(),"WaitForSingleObject");
      return value==0;
    }
    public uint ExitCode() { uint code; Check(GetExitCodeProcess(process,out code),"GetExitCodeProcess"); return code; }
    public void Dispose() {
      if (job!=IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; }
      if (process!=IntPtr.Zero) { CloseHandle(process); process=IntPtr.Zero; }
      if (restricted!=IntPtr.Zero) { CloseHandle(restricted); restricted=IntPtr.Zero; }
      if (current!=IntPtr.Zero) { CloseHandle(current); current=IntPtr.Zero; }
    }
  }
}
