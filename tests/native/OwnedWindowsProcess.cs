// Same-account test process ownership only. No token, account, ACL or privilege changes.
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace FolioNativeSmoke {
  public sealed class OwnedWindowsProcess : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimit {
      public long perProcessTime, perJobTime; public uint flags;
      public UIntPtr minWorking, maxWorking; public uint activeLimit;
      public UIntPtr affinity; public uint priority, scheduling;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit {
      public BasicLimit basic; public IoCounters io;
      public UIntPtr processMemory, jobMemory, peakProcessMemory, peakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
      public long a,b,c,d; public uint faults,total,active,terminated;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup {
      public uint cb; public string reserved,desktop,title; public uint x,y,cx,cy,charsX,charsY,fill,flags;
      public ushort show,reservedSize; public IntPtr reservedPointer,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int info,ref ExtendedLimit limit,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int info,out Accounting value,uint size,IntPtr returned);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string exe,StringBuilder cmd,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo result);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
    IntPtr job,process;
    bool stopped;
    public uint Pid { get; private set; }
    public bool Empty { get; private set; }
    public uint ExitCode { get { uint code; Check(GetExitCodeProcess(process,out code),"Read owned exit code"); return code; } }
    static void Check(bool ok,string operation) { if(!ok)throw new Win32Exception(Marshal.GetLastWin32Error(),operation); }
    public OwnedWindowsProcess(string executable,string directory) {
      IntPtr thread=IntPtr.Zero;
      try {
        job=CreateJobObject(IntPtr.Zero,null); Check(job!=IntPtr.Zero,"Create private job");
        var limit=new ExtendedLimit(); limit.basic.flags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        Check(SetInformationJobObject(job,9,ref limit,(uint)Marshal.SizeOf(typeof(ExtendedLimit))),"Set owned job lifetime");
        var startup=new Startup { cb=(uint)Marshal.SizeOf(typeof(Startup)),flags=1,show=0 };
        ProcessInfo child;
        Check(CreateProcess(executable,new StringBuilder("\""+executable+"\""),IntPtr.Zero,IntPtr.Zero,false,0x08000004,IntPtr.Zero,directory,ref startup,out child),"Create suspended same-account app");
        process=child.process; thread=child.thread; Pid=child.pid;
        Check(AssignProcessToJobObject(job,process),"Assign owned app before resuming");
        Check(ResumeThread(thread)!=0xffffffff,"Resume owned app");
      } catch { if(process!=IntPtr.Zero)TerminateProcess(process,1); Dispose(); throw; }
      finally { if(thread!=IntPtr.Zero)CloseHandle(thread); }
    }
    public void Stop() {
      if(stopped)return;
      Check(TerminateJobObject(job,0),"Stop owned job");
      for(int attempt=0;attempt<250;attempt++) {
        Accounting value;
        Check(QueryInformationJobObject(job,1,out value,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero),"Check owned job cleanup");
        if(value.active==0){Empty=true;stopped=true;return;}
        Thread.Sleep(20);
      }
      throw new InvalidOperationException("Owned job did not empty within five seconds.");
    }
    public void Dispose() {
      try { if(job!=IntPtr.Zero&&!stopped)Stop(); }
      finally { if(job!=IntPtr.Zero){CloseHandle(job);job=IntPtr.Zero;} if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;} }
    }
  }
}
