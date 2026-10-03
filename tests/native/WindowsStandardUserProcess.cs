// Disposable hosted-CI launcher. Creates one temporary Users-only account and private desktop.
// Never grants privileges, changes system policies, or changes application permissions.
using System;
using System.ComponentModel;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Threading;
using System.Text;

namespace FolioNativeSmoke {
  public sealed class TokenFacts {
    public string UserSid;
    public int TokenSessionId;
    public uint? ProcessSessionId;
    public bool Elevated;
    public int ElevationType;
    public int IntegrityRid;
    public bool AdministratorsEnabled;
    public bool AdministratorsDenyOnly;
    public bool MatchesExpectedUser;
    public bool AdministratorsPresent;
    public bool UsersEnabled;
    public bool HasRestrictions;
    public int RestrictionReturnLength;
    public uint RestrictionRawValue;
    public int RestrictingSidCount;
  }
  public sealed class WriteProbe { public bool Writable; public int Error; public string Message; }
  public sealed class AccessProbe { public string Target; public bool Opened; public int Error; public string Message; }
  public sealed class RuntimeExit { public uint Pid; public bool Exited; public uint? ExitCode; }
  public sealed class CleanupFacts {
    public bool OwnedJobEmpty=true, ProfileUnloaded=true, ProfileDeleted=true, AccountRemoved=true, PrivateDesktopClosed=true;
    public List<string> Errors=new List<string>();
  }

  public sealed class StandardUserProcess : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct SidAttributes { public IntPtr Sid; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
      public int cb; public string reserved; public string desktop; public string title;
      public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort showWindow,reserved2;
      public IntPtr reservedPointer,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes { public int length; public IntPtr descriptor; public int inherit; }
    [StructLayout(LayoutKind.Sequential)] struct JobBasicLimits {
      public long processTime,jobTime; public uint flags; public UIntPtr minWorkingSet,maxWorkingSet;
      public uint activeProcesses; public UIntPtr affinity; public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
    [StructLayout(LayoutKind.Sequential)] struct JobLimits {
      public JobBasicLimits basic; public IoCounters io;
      public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct JobAccounting {
      public long userTime,kernelTime,periodUserTime,periodKernelTime;
      public uint faults,totalProcesses,activeProcesses,terminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct UserInfo {
      public string name; public IntPtr password; public uint passwordAge,privilege; public string home,comment;
      public uint flags; public string script;
    }
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct ProfileInfo {
      public uint size,flags; public string username,path,defaultPath,server,policyPath; public IntPtr profile;
    }
    [StructLayout(LayoutKind.Sequential)] struct UserInfo23 { public IntPtr name,fullName,comment; public uint flags; public IntPtr sid; }
    [StructLayout(LayoutKind.Sequential)] struct Luid { public uint low; public int high; }
    [StructLayout(LayoutKind.Sequential)] struct TokenPrivilege { public uint count; public Luid luid; public uint attributes; }
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll", EntryPoint="OpenMutexW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr OpenMutex(uint access, bool inherit, string name);
    [DllImport("kernel32.dll", EntryPoint="CreateMutexW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateMutex(IntPtr attributes, bool initialOwner, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool ProcessIdToSessionId(uint pid, out uint session);
    [DllImport("kernel32.dll")] static extern uint GetCurrentProcessId();
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
    [DllImport("kernel32.dll", EntryPoint="CreateJobObjectW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref JobLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out JobAccounting value, uint size, IntPtr needed);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr value);
    [DllImport("kernel32.dll", EntryPoint="CreateFileW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateFile(string path, uint access, uint sharing, ref SecurityAttributes attributes, uint creation, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool WriteFile(IntPtr file, byte[] bytes, uint count, out uint written, IntPtr overlapped);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll",EntryPoint="LookupPrivilegeValueW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool LookupPrivilegeValue(string system,string name,out Luid luid);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool AdjustTokenPrivileges(IntPtr token,bool disable,ref TokenPrivilege value,uint size,out TokenPrivilege previous,out uint needed);
    [DllImport("advapi32.dll",EntryPoint="AdjustTokenPrivileges",SetLastError=true)] static extern bool RestoreTokenPrivileges(IntPtr token,bool disable,ref TokenPrivilege value,uint size,IntPtr previous,IntPtr needed);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr data, int size, out int needed);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool ImpersonateLoggedOnUser(IntPtr token);
    [DllImport("advapi32.dll", SetLastError=true)] static extern bool RevertToSelf();
    [DllImport("advapi32.dll", EntryPoint="CreateProcessWithLogonW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool CreateProcessWithLogon(string username, string domain, IntPtr password, uint logonFlags, string app, StringBuilder command,
      uint flags, IntPtr environment, string directory,
      ref StartupInfo startup, out ProcessInfo process);
    [DllImport("advapi32.dll", EntryPoint="LogonUserW", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool LogonUser(string name,string domain,IntPtr password,uint logonType,uint provider,out IntPtr token);
    [DllImport("advapi32.dll",EntryPoint="ConvertStringSecurityDescriptorToSecurityDescriptorW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool ConvertDescriptor(string text,uint revision,out IntPtr descriptor,IntPtr size);
    [DllImport("netapi32.dll",CharSet=CharSet.Unicode)] static extern uint NetUserAdd(string server,uint level,ref UserInfo user,out uint parameter);
    [DllImport("netapi32.dll",CharSet=CharSet.Unicode)] static extern uint NetUserDel(string server,string user);
    [DllImport("netapi32.dll",CharSet=CharSet.Unicode)] static extern uint NetUserGetInfo(string server,string user,uint level,out IntPtr info);
    [DllImport("netapi32.dll")] static extern uint NetApiBufferFree(IntPtr buffer);
    [DllImport("netapi32.dll",CharSet=CharSet.Unicode)] static extern uint NetLocalGroupAddMembers(string server,string group,uint level,ref IntPtr sid,uint count);
    [DllImport("userenv.dll",EntryPoint="LoadUserProfileW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool LoadUserProfile(IntPtr token,ref ProfileInfo info);
    [DllImport("userenv.dll",SetLastError=true)] static extern bool UnloadUserProfile(IntPtr token,IntPtr profile);
    [DllImport("userenv.dll",EntryPoint="DeleteProfileW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool DeleteProfile(string sid,string path,string computer);
    [DllImport("userenv.dll",SetLastError=true)] static extern bool CreateEnvironmentBlock(out IntPtr block,IntPtr token,bool inherit);
    [DllImport("userenv.dll")] static extern bool DestroyEnvironmentBlock(IntPtr block);
    [DllImport("user32.dll",EntryPoint="CreateWindowStationW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern IntPtr CreateWindowStation(string name,uint flags,uint access,ref SecurityAttributes security);
    [DllImport("user32.dll",EntryPoint="CreateDesktopW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern IntPtr CreateDesktop(string name,string device,IntPtr mode,uint flags,uint access,ref SecurityAttributes security);
    [DllImport("user32.dll",SetLastError=true)] static extern IntPtr GetProcessWindowStation();
    [DllImport("user32.dll",SetLastError=true)] static extern bool SetProcessWindowStation(IntPtr station);
    [DllImport("user32.dll",SetLastError=true)] static extern bool CloseWindowStation(IntPtr station);
    [DllImport("user32.dll",SetLastError=true)] static extern bool CloseDesktop(IntPtr desktop);

    IntPtr targetToken, process, job, station, desktop, profile, environment;
    IntPtr passwordBuffer;
    const int PasswordCharacters=36;
    readonly Dictionary<uint,IntPtr> observedRuntime=new Dictionary<uint,IntPtr>();
    string user;
    string accountName,desktopPath;
    bool accountCreated,cleaned;
    public TokenFacts Parent { get; private set; }
    public TokenFacts Standard { get; private set; }
    public TokenFacts Child { get; private set; }
    public uint Pid { get; private set; }
    public string AccountName { get { return accountName; } }
    public string AccountSid { get { return user; } }
    public string PrivateDesktop { get { return desktopPath; } }
    public CleanupFacts Cleanup { get; private set; }

    static void Check(bool ok, string operation) {
      if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error(), operation);
    }
    sealed class AssignedPrivilegeScope : IDisposable {
      IntPtr token; TokenPrivilege previous; bool changed;
      public AssignedPrivilegeScope(string name) {
        if (name!="SeBackupPrivilege" && name!="SeRestorePrivilege") throw new InvalidOperationException("Only owned-profile privileges are permitted.");
        try {
          Check(OpenProcessToken(GetCurrentProcess(),0x28,out token),"Open existing caller privileges");
          Luid luid; Check(LookupPrivilegeValue(null,name,out luid),"Lookup existing profile privilege");
          var value=new TokenPrivilege { count=1,luid=luid,attributes=2 };
          uint needed;
          bool ok=AdjustTokenPrivileges(token,false,ref value,(uint)Marshal.SizeOf(typeof(TokenPrivilege)),out previous,out needed);
          int error=Marshal.GetLastWin32Error(); changed=previous.count!=0;
          if (!ok || error!=0) throw new Win32Exception(error,"Enable already-assigned profile privilege (missing rights are never granted)");
        } catch { Dispose(); throw; }
      }
      public void Dispose() {
        if (token==IntPtr.Zero) return;
        try {
          if (changed) {
            bool ok=RestoreTokenPrivileges(token,false,ref previous,0,IntPtr.Zero,IntPtr.Zero);
            int error=Marshal.GetLastWin32Error();
            if (!ok || error!=0) throw new Win32Exception(error,"Restore exact original profile privilege state");
          }
        } finally { CloseHandle(token); token=IntPtr.Zero; }
      }
    }
    static void ProfileOperation(Func<bool> operation,string description) {
      using (var backup=new AssignedPrivilegeScope("SeBackupPrivilege"))
      using (var restore=new AssignedPrivilegeScope("SeRestorePrivilege")) Check(operation(),description);
    }
    static IntPtr ReadInfo(IntPtr token, int kind) {
      int returned; return ReadInfo(token,kind,out returned);
    }
    static IntPtr ReadInfo(IntPtr token, int kind, out int returned) {
      int size;
      GetTokenInformation(token, kind, IntPtr.Zero, 0, out size);
      if (size <= 0) throw new Win32Exception(Marshal.GetLastWin32Error(), "GetTokenInformation size " + kind);
      IntPtr data = Marshal.AllocHGlobal(size);
      try {
        Check(GetTokenInformation(token, kind, data, size, out returned), "GetTokenInformation " + kind);
        if (returned<=0 || returned>size) throw new InvalidOperationException("Invalid returned token buffer length for class "+kind);
        return data;
      }
      catch { Marshal.FreeHGlobal(data); throw; }
    }
    static int ReadNumber(IntPtr token, int kind) {
      int returned; IntPtr data=ReadInfo(token,kind,out returned);
      try {
        if (returned<4) throw new InvalidOperationException("Token scalar shorter than DWORD for class "+kind);
        return Marshal.ReadInt32(data);
      } finally { Marshal.FreeHGlobal(data); }
    }
    static uint ReadRestrictions(IntPtr token,out int returned) {
      // The API documents DWORD, but current Windows has been observed returning one byte.
      // Always provide an initialized DWORD, inspect ReturnLength, never read beyond returned data.
      // https://learn.microsoft.com/en-us/answers/questions/6000453/gettokeninformation-tokenhasrestrictions-21-return
      IntPtr data=Marshal.AllocHGlobal(4);
      try {
        Marshal.WriteInt32(data,0);
        Check(GetTokenInformation(token,21,data,4,out returned),"GetTokenInformation TokenHasRestrictions");
        if (returned==1) return Marshal.ReadByte(data);
        if (returned==4) return unchecked((uint)Marshal.ReadInt32(data));
        throw new InvalidOperationException("Unexpected TokenHasRestrictions return length "+returned);
      } finally { Marshal.FreeHGlobal(data); }
    }
    static string ReadSid(IntPtr token, int kind) {
      IntPtr data=ReadInfo(token,kind);
      try { return new SecurityIdentifier(Marshal.ReadIntPtr(data)).Value; } finally { Marshal.FreeHGlobal(data); }
    }
    static TokenFacts Inspect(IntPtr token, string user) {
      string integrity=ReadSid(token,25);
      int restrictionLength; uint restrictionValue=ReadRestrictions(token,out restrictionLength);
      var facts=new TokenFacts { UserSid=ReadSid(token,1), TokenSessionId=ReadNumber(token,12), Elevated=ReadNumber(token,20)!=0, ElevationType=ReadNumber(token,18),
        IntegrityRid=int.Parse(integrity.Substring(integrity.LastIndexOf('-')+1)), MatchesExpectedUser=ReadSid(token,1)==user,
        HasRestrictions=restrictionValue!=0, RestrictionReturnLength=restrictionLength, RestrictionRawValue=restrictionValue,
        RestrictingSidCount=ReadNumber(token,11) };
      IntPtr groups=ReadInfo(token,2);
      try {
        int count=Marshal.ReadInt32(groups), offset=IntPtr.Size==8 ? 8 : 4, stride=Marshal.SizeOf(typeof(SidAttributes));
        for (int i=0;i<count;i++) {
          var entry=(SidAttributes)Marshal.PtrToStructure(IntPtr.Add(groups,offset+i*stride),typeof(SidAttributes));
          if (new SecurityIdentifier(entry.Sid).IsWellKnown(WellKnownSidType.BuiltinAdministratorsSid)) {
            facts.AdministratorsPresent=true;
            facts.AdministratorsEnabled=(entry.Attributes&4)!=0;
            facts.AdministratorsDenyOnly=(entry.Attributes&16)!=0;
          }
          if (new SecurityIdentifier(entry.Sid).IsWellKnown(WellKnownSidType.BuiltinUsersSid)) facts.UsersEnabled=(entry.Attributes&4)!=0;
        }
      } finally { Marshal.FreeHGlobal(groups); }
      return facts;
    }
    static void RequireStandard(TokenFacts facts) {
      if (facts.Elevated || facts.IntegrityRid!=8192 || facts.AdministratorsPresent || !facts.MatchesExpectedUser ||
          !facts.UsersEnabled || facts.HasRestrictions || facts.RestrictingSidCount!=0)
        throw new InvalidOperationException("Refusing launch: expected genuine created Users-only Medium token; Elevated="+facts.Elevated+
          ", IntegrityRid="+facts.IntegrityRid+", AdministratorsPresent="+facts.AdministratorsPresent+", MatchesExpectedUser="+facts.MatchesExpectedUser+
          ", UsersEnabled="+facts.UsersEnabled+", HasRestrictions="+facts.HasRestrictions+", RestrictingSidCount="+facts.RestrictingSidCount);
    }
    static IntPtr SidBytes(string value, out int length) {
      var sid=new SecurityIdentifier(value); byte[] bytes=new byte[sid.BinaryLength]; sid.GetBinaryForm(bytes,0);
      length=bytes.Length; IntPtr pointer=Marshal.AllocHGlobal(length); Marshal.Copy(bytes,0,pointer,length); return pointer;
    }
    public static TokenFacts CurrentToken() {
      IntPtr token; Check(OpenProcessToken(GetCurrentProcess(),8,out token),"OpenProcessToken diagnostic");
      try { var facts=Inspect(token,ReadSid(token,1)); facts.ProcessSessionId=ReadProcessSession(GetCurrentProcessId()); return facts; }
      finally { CloseHandle(token); }
    }
    static uint ReadProcessSession(uint pid) {
      uint session; Check(ProcessIdToSessionId(pid,out session),"ProcessIdToSessionId owned process"); return session;
    }
    void GenerateCredential() {
      // Credential text exists only in this private unmanaged UTF-16 buffer, never in a managed string.
      byte[] entropy=new byte[PasswordCharacters-4];
      try {
        using (var random=RandomNumberGenerator.Create()) random.GetBytes(entropy);
        passwordBuffer=Marshal.AllocHGlobal((PasswordCharacters+1)*2);
        const string alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const string categories="Aa1!";
        for (int i=0;i<4;i++) Marshal.WriteInt16(passwordBuffer,i*2,(short)categories[i]);
        for (int i=0;i<entropy.Length;i++) Marshal.WriteInt16(passwordBuffer,(i+4)*2,(short)alphabet[entropy[i]&63]);
        Marshal.WriteInt16(passwordBuffer,PasswordCharacters*2,0);
      } finally { Array.Clear(entropy,0,entropy.Length); }
    }
    void ClearCredential() {
      if (passwordBuffer==IntPtr.Zero) return;
      // Explicit writes ensure the unmanaged password is erased before freeing, including its terminator.
      for (int i=0;i<=PasswordCharacters;i++) Marshal.WriteInt16(passwordBuffer,i*2,0);
      Marshal.FreeHGlobal(passwordBuffer); passwordBuffer=IntPtr.Zero;
    }
    public StandardUserProcess(Action<string,string> accountReceipt) {
      if (Environment.OSVersion.Platform!=PlatformID.Win32NT || Environment.GetEnvironmentVariable("GITHUB_ACTIONS")!="true" ||
          Environment.GetEnvironmentVariable("CI")!="true" || Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")!="github-hosted")
        throw new InvalidOperationException("Temporary account creation is restricted to disposable GitHub-hosted Windows CI.");
      Cleanup=new CleanupFacts();
      try {
        Parent=CurrentToken();
        accountName="FolioCI_"+Guid.NewGuid().ToString("N").Substring(0,12);
        GenerateCredential();
        var info=new UserInfo { name=accountName,password=passwordBuffer,privilege=1,flags=0x201,comment="Disposable Folio native CI test" };
        try {
          uint parameter; uint status=NetUserAdd(null,1,ref info,out parameter);
          if (status!=0) throw new Win32Exception((int)status,"NetUserAdd temporary standard account (parameter "+parameter+")");
          accountCreated=true;
          user=LookupLocalSid(accountName);
          if (user==null) throw new InvalidOperationException("Created local account SID could not be resolved.");
          // Persist only ownership identifiers before any potentially slow profile operation, never credentials.
          if (accountReceipt==null) throw new InvalidOperationException("Owned-account cleanup receipt callback is required.");
          accountReceipt(accountName,user);
          int ignored; IntPtr sid=SidBytes(user,out ignored);
          try {
            string group=((NTAccount)new SecurityIdentifier(WellKnownSidType.BuiltinUsersSid,null).Translate(typeof(NTAccount))).Value;
            group=group.Substring(group.LastIndexOf('\\')+1);
            status=NetLocalGroupAddMembers(null,group,0,ref sid,1);
            if (status!=0 && status!=1378) throw new Win32Exception((int)status,"NetLocalGroupAddMembers Users only");
          } finally { Marshal.FreeHGlobal(sid); }
          Check(LogonUser(accountName,Environment.MachineName,passwordBuffer,2,0,out targetToken),"LogonUser standard account");
        } finally { info.password=IntPtr.Zero; }
        Standard=Inspect(targetToken,user); RequireStandard(Standard);
        var loaded=new ProfileInfo { size=(uint)Marshal.SizeOf(typeof(ProfileInfo)),flags=1,username=accountName };
        ProfileOperation(()=>{ bool ok=LoadUserProfile(targetToken,ref loaded); if (ok) profile=loaded.profile; return ok; },"LoadUserProfile temporary account");
        IntPtr originalEnvironment;
        Check(CreateEnvironmentBlock(out originalEnvironment,targetToken,false),"CreateEnvironmentBlock without runner inheritance");
        try {
          var values=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
          int offset=0;
          while (Marshal.ReadInt16(originalEnvironment,offset)!=0) {
            string item=Marshal.PtrToStringUni(IntPtr.Add(originalEnvironment,offset)); offset+=(item.Length+1)*2;
            int split=item.IndexOf('=',1); if (split>0) values[item.Substring(0,split)]=item.Substring(split+1);
          }
          foreach (string key in new [] { "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS","WEBVIEW2_USER_DATA_FOLDER","RUST_BACKTRACE" }) {
            string value=Environment.GetEnvironmentVariable(key); if (value!=null) values[key]=value;
          }
          var block=new StringBuilder(); foreach (var item in values) block.Append(item.Key).Append('=').Append(item.Value).Append('\0');
          block.Append('\0'); environment=Marshal.StringToHGlobalUni(block.ToString());
        } finally { DestroyEnvironmentBlock(originalEnvironment); }
        string runner=WindowsIdentity.GetCurrent().User.Value;
        string descriptor="D:P(A;;GA;;;SY)(A;;GA;;;"+runner+")(A;;GA;;;"+user+")S:(ML;;NW;;;ME)";
        IntPtr securityDescriptor;
        Check(ConvertDescriptor(descriptor,1,out securityDescriptor,IntPtr.Zero),"Create private user-object security descriptor");
        IntPtr originalStation=GetProcessWindowStation();
        if (originalStation==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(),"GetProcessWindowStation");
        try {
          var security=new SecurityAttributes { length=Marshal.SizeOf(typeof(SecurityAttributes)),descriptor=securityDescriptor,inherit=0 };
          string name="FolioCI_"+Guid.NewGuid().ToString("N");
          station=CreateWindowStation(name,1,0x000f037f,ref security); // CWF_CREATE_ONLY, private station access
          if (station==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(),"Create private window station");
          Check(SetProcessWindowStation(station),"Select private helper window station");
          desktop=CreateDesktop("FolioDesktop",null,IntPtr.Zero,0,0x000f01ff,ref security); // no cross-account hooks
          if (desktop==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(),"Create private desktop");
          desktopPath=name+"\\FolioDesktop";
        } finally {
          LocalFree(securityDescriptor);
          Check(SetProcessWindowStation(originalStation),"Restore helper window station");
        }
      } catch (Exception error) { Dispose(); throw new InvalidOperationException("Standard-user CI setup failed. Cleanup errors: "+String.Join("; ",Cleanup.Errors),error); }
    }
    public WriteProbe ProbeProfileWrite(string directory) {
      // The caller supplies only its verified fresh CI profile directory. No existing file is opened or removed.
      string path=Path.Combine(directory,"folio-access-probe-"+Guid.NewGuid().ToString("N")+".tmp");
      Check(ImpersonateLoggedOnUser(targetToken),"Impersonate created standard user for profile probe");
      try {
        var security=new SecurityAttributes { length=Marshal.SizeOf(typeof(SecurityAttributes)), inherit=0 };
        // WRITE | DELETE, CREATE_NEW, TEMPORARY | DELETE_ON_CLOSE.
        IntPtr file=CreateFile(path,0x40010000,0,ref security,1,0x04000100,IntPtr.Zero);
        if (file==new IntPtr(-1)) {
          int error=Marshal.GetLastWin32Error();
          return new WriteProbe { Writable=false, Error=error, Message=new Win32Exception(error).Message };
        }
        try {
          uint written;
          if (!WriteFile(file,new byte[] { 0x46 },1,out written,IntPtr.Zero)) {
            int error=Marshal.GetLastWin32Error();
            return new WriteProbe { Writable=false, Error=error, Message=new Win32Exception(error).Message };
          }
          if (written!=1) return new WriteProbe { Writable=false, Error=31, Message="Profile probe write was incomplete." };
        } finally { Check(CloseHandle(file),"Close owned profile access probe"); }
        return new WriteProbe { Writable=true, Error=0, Message="Standard user can create/write/delete a new profile file." };
      } finally { Check(RevertToSelf(),"Revert standard-user profile probe impersonation"); }
    }
    public AccessProbe ProbeUpstreamSingletonMutex() {
      // Upstream Chromium name only; Microsoft Edge may use another name. Never create/acquire/change it.
      const string name="Local\\ChromeProcessSingletonStartup!";
      Check(ImpersonateLoggedOnUser(targetToken),"Impersonate standard user for read-only mutex probe");
      try {
        IntPtr handle=OpenMutex(0x001f0001,false,name); // MUTEX_ALL_ACCESS, as requested by upstream CreateMutex.
        int error=handle==IntPtr.Zero ? Marshal.GetLastWin32Error() : 0;
        if (handle!=IntPtr.Zero) Check(CloseHandle(handle),"Close read-only mutex probe");
        return new AccessProbe { Target=name, Opened=handle!=IntPtr.Zero, Error=error,
          Message=error==0 ? "Existing mutex opened and immediately closed; never acquired." : new Win32Exception(error).Message };
      } finally { Check(RevertToSelf(),"Revert read-only mutex probe impersonation"); }
    }
    public AccessProbe ProbeFreshSessionMutex() {
      // Test only a random disposable name, never create/open the browser's singleton name.
      string name="Local\\FolioNativeSmoke_"+Guid.NewGuid().ToString("N");
      Check(ImpersonateLoggedOnUser(targetToken),"Impersonate standard user for owned session mutex probe");
      try {
        IntPtr handle=CreateMutex(IntPtr.Zero,false,name); // Default token DACL; non-inheritable; never acquire ownership.
        int error=Marshal.GetLastWin32Error();
        if (handle!=IntPtr.Zero) {
          Check(CloseHandle(handle),"Close fresh session mutex probe");
          if (error==183) throw new InvalidOperationException("Random diagnostic mutex unexpectedly existed; no ownership was acquired.");
          error=0;
        }
        return new AccessProbe { Target=name, Opened=handle!=IntPtr.Zero, Error=error,
          Message=error==0 ? "Fresh session mutex created without ownership, immediately closed and destroyed." : new Win32Exception(error).Message };
      } finally { Check(RevertToSelf(),"Revert owned session mutex probe impersonation"); }
    }
    public AccessProbe ProbeExistingSingletonFile(string directory) {
      string path=Path.Combine(directory,"lockfile");
      Check(ImpersonateLoggedOnUser(targetToken),"Impersonate standard user for read-only singleton file probe");
      try {
        var security=new SecurityAttributes { length=Marshal.SizeOf(typeof(SecurityAttributes)),inherit=0 };
        // OPEN_EXISTING with no desired access and full sharing. Does not create, truncate, write or delete.
        IntPtr handle=CreateFile(path,0,7,ref security,3,0x00200000,IntPtr.Zero); // OPEN_REPARSE_POINT
        int error=handle==new IntPtr(-1) ? Marshal.GetLastWin32Error() : 0;
        if (handle!=new IntPtr(-1)) Check(CloseHandle(handle),"Close read-only singleton file probe");
        return new AccessProbe { Target=path, Opened=handle!=new IntPtr(-1), Error=error,
          Message=error==0 ? "Existing lockfile opened for metadata only and immediately closed." : new Win32Exception(error).Message };
      } finally { Check(RevertToSelf(),"Revert read-only singleton file probe impersonation"); }
    }
    public void Launch(string executable, string directory) {
      try {
      if (process!=IntPtr.Zero) throw new InvalidOperationException("Only one owned child is allowed.");
      if (passwordBuffer==IntPtr.Zero) throw new InvalidOperationException("One-time native launch credential is unavailable.");
      job=CreateJobObject(IntPtr.Zero,null);
      if (job==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(),"CreateJobObject");
      var limits=new JobLimits { basic=new JobBasicLimits { flags=0x2000 } }; // KILL_ON_JOB_CLOSE
      Check(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(JobLimits))),"SetInformationJobObject kill-on-close");
      ProcessInfo child;
      var startup=new StartupInfo { cb=Marshal.SizeOf(typeof(StartupInfo)),desktop=desktopPath,flags=1,showWindow=0 };
      // Plain documented startup; no STARTF_USESTDHANDLES, no caller handles, no extended attributes.
      // CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT | CREATE_SUSPENDED.
      // Browser file logging is retained; native stdout/stderr redirection is deliberately unavailable.
      // Logon flags zero: the exact user's profile is already loaded; no duplicate load or network-only token.
      bool created;
      int launchError;
      try {
        created=CreateProcessWithLogon(accountName,Environment.MachineName,passwordBuffer,0,executable,new StringBuilder("\""+executable+"\""),
          0x08000404,environment,directory,ref startup,out child);
        launchError=Marshal.GetLastWin32Error();
      } finally { ClearCredential(); }
      if (!created) throw new Win32Exception(launchError,"CreateProcessWithLogon plain startup on private desktop");
      process=child.process; Pid=child.pid;
      try {
        // Closing the helper, including any exception, kills only this assigned child tree.
        Check(AssignProcessToJobObject(job,process),"AssignProcessToJobObject owned child");
        IntPtr token;
        Check(OpenProcessToken(process,8,out token),"OpenProcessToken child");
        try { Child=Inspect(token,user); Child.ProcessSessionId=ReadProcessSession(Pid); RequireStandard(Child); } finally { CloseHandle(token); }
        if (ResumeThread(child.thread)==0xffffffff) throw new Win32Exception(Marshal.GetLastWin32Error(),"ResumeThread");
      } catch { TerminateProcess(process,1); throw; }
      finally { CloseHandle(child.thread); }
      } finally { ClearCredential(); }
    }
    public bool Wait(uint milliseconds) {
      uint value=WaitForSingleObject(process,milliseconds);
      if (value==0xffffffff) throw new Win32Exception(Marshal.GetLastWin32Error(),"WaitForSingleObject");
      return value==0;
    }
    public bool ObserveRuntime(uint pid) {
      if (observedRuntime.ContainsKey(pid)) return true;
      if (observedRuntime.Count>=64 || job==IntPtr.Zero) return false;
      // Read-only handles; no process-memory access, termination permission or inheritance.
      IntPtr handle=OpenProcess(0x101000,false,pid);
      if (handle==IntPtr.Zero) return false;
      bool member;
      if (!IsProcessInJob(handle,job,out member) || !member) { CloseHandle(handle); return false; }
      observedRuntime.Add(pid,handle); return true;
    }
    public RuntimeExit[] RuntimeExits() {
      var facts=new List<RuntimeExit>();
      foreach (var entry in observedRuntime) {
        bool exited=WaitForSingleObject(entry.Value,0)==0;
        uint code;
        uint? exitCode=exited && GetExitCodeProcess(entry.Value,out code) ? (uint?)code : null;
        facts.Add(new RuntimeExit { Pid=entry.Key, Exited=exited, ExitCode=exitCode });
      }
      return facts.ToArray();
    }
    public TokenFacts RuntimeToken(uint pid) {
      IntPtr handle;
      if (!observedRuntime.TryGetValue(pid,out handle)) throw new InvalidOperationException("Runtime token inspection requires an observed member of our owned job.");
      IntPtr token; Check(OpenProcessToken(handle,8,out token),"Read owned runtime process token");
      try { var facts=Inspect(token,user); facts.ProcessSessionId=ReadProcessSession(pid); return facts; } finally { CloseHandle(token); }
    }
    public uint ExitCode() { uint code; Check(GetExitCodeProcess(process,out code),"GetExitCodeProcess"); return code; }
    static string LookupLocalSid(string name) {
      IntPtr buffer; uint status=NetUserGetInfo(null,name,23,out buffer);
      if (status==2221) return null;
      if (status!=0) throw new Win32Exception((int)status,"NetUserGetInfo exact local account");
      try {
        var info=(UserInfo23)Marshal.PtrToStructure(buffer,typeof(UserInfo23));
        return new SecurityIdentifier(info.sid).Value;
      } finally { NetApiBufferFree(buffer); }
    }
    public static bool RemoveExactAccount(string name,string expectedSid) {
      if (Environment.GetEnvironmentVariable("GITHUB_ACTIONS")!="true" || Environment.GetEnvironmentVariable("CI")!="true" ||
          Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT")!="github-hosted")
        throw new InvalidOperationException("Account cleanup is disposable hosted-CI only.");
      if (!System.Text.RegularExpressions.Regex.IsMatch(name??"","^FolioCI_[0-9a-f]{12}$") || String.IsNullOrEmpty(expectedSid))
        throw new InvalidOperationException("Exact generated account name and SID required for cleanup.");
      string actual=LookupLocalSid(name);
      if (actual==null) return true;
      if (actual!=expectedSid) throw new InvalidOperationException("Account SID changed; refusing account removal.");
      uint status=NetUserDel(null,name);
      if (status!=0) throw new Win32Exception((int)status,"NetUserDel exact temporary account");
      return LookupLocalSid(name)==null;
    }
    public void Dispose() {
      ClearCredential();
      if (cleaned) return;
      cleaned=true;
      if (job!=IntPtr.Zero) {
        try {
          Check(TerminateJobObject(job,0),"Terminate owned job for cleanup");
          DateTime deadline=DateTime.UtcNow.AddSeconds(10);
          do {
            JobAccounting accounting;
            Check(QueryInformationJobObject(job,1,out accounting,(uint)Marshal.SizeOf(typeof(JobAccounting)),IntPtr.Zero),"Query owned job active processes");
            if (accounting.activeProcesses==0) { Cleanup.OwnedJobEmpty=true; break; }
            Cleanup.OwnedJobEmpty=false; Thread.Sleep(50);
          } while (DateTime.UtcNow<deadline);
          if (!Cleanup.OwnedJobEmpty) throw new InvalidOperationException("Owned job did not become empty within 10 seconds.");
        } catch (Exception error) { Cleanup.OwnedJobEmpty=false; Cleanup.Errors.Add(error.Message); }
      }
      if (job!=IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; }
      foreach (var handle in observedRuntime.Values) CloseHandle(handle);
      observedRuntime.Clear();
      if (process!=IntPtr.Zero) { CloseHandle(process); process=IntPtr.Zero; }
      if (desktop!=IntPtr.Zero) {
        if (!CloseDesktop(desktop)) { Cleanup.PrivateDesktopClosed=false; Cleanup.Errors.Add("CloseDesktop error "+Marshal.GetLastWin32Error()); }
        desktop=IntPtr.Zero;
      }
      if (station!=IntPtr.Zero) {
        if (!CloseWindowStation(station)) { Cleanup.PrivateDesktopClosed=false; Cleanup.Errors.Add("CloseWindowStation error "+Marshal.GetLastWin32Error()); }
        station=IntPtr.Zero;
      }
      if (environment!=IntPtr.Zero) { Marshal.FreeHGlobal(environment); environment=IntPtr.Zero; }
      if (profile!=IntPtr.Zero) {
        Cleanup.ProfileUnloaded=false;
        if (Cleanup.OwnedJobEmpty) {
          for (int retry=0;retry<10;retry++) {
            try { ProfileOperation(()=>UnloadUserProfile(targetToken,profile),"UnloadUserProfile temporary account"); Cleanup.ProfileUnloaded=true; profile=IntPtr.Zero; break; }
            catch (Exception error) {
              var native=error as Win32Exception;
              if (retry==9 || native==null || (native.NativeErrorCode!=170 && native.NativeErrorCode!=32)) { Cleanup.Errors.Add(error.Message); break; }
              Thread.Sleep(200);
            }
          }
        } else Cleanup.Errors.Add("Profile not unloaded because owned processes remain.");
      }
      if (targetToken!=IntPtr.Zero) { CloseHandle(targetToken); targetToken=IntPtr.Zero; }
      if (accountCreated) {
        Cleanup.AccountRemoved=false;
        try {
          if (user==null) user=LookupLocalSid(accountName);
          if (Cleanup.ProfileUnloaded && Cleanup.OwnedJobEmpty && user!=null && LookupLocalSid(accountName)==user) {
            try { ProfileOperation(()=>DeleteProfile(user,null,null),"Delete exact created profile"); }
            catch (Win32Exception error) { if (error.NativeErrorCode!=2 && error.NativeErrorCode!=3) { Cleanup.ProfileDeleted=false; Cleanup.Errors.Add(error.Message); } }
          } else { Cleanup.ProfileDeleted=false; Cleanup.Errors.Add("Created profile deletion skipped because prior cleanup or identity verification failed."); }
          Cleanup.AccountRemoved=RemoveExactAccount(accountName,user);
          if (!Cleanup.AccountRemoved) throw new InvalidOperationException("Temporary account still exists after removal.");
          accountCreated=false;
        } catch (Exception error) { Cleanup.Errors.Add(error.Message); }
      }
    }
  }
}
