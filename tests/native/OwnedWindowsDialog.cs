// Test-only native dialog interaction. Every HWND is restricted to the exact owned PID.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace FolioNativeSmoke {
  public static class OwnedWindowsDialog {
    public sealed class WindowInfo {
      public long Handle { get; set; }
      public string ClassName { get; set; }
      public bool Enabled { get; set; }
    }
    delegate bool EnumWindowProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowProc callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent, IntPtr child);
    [DllImport("user32.dll", SetLastError=true)] static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    public static WindowInfo[] Dialogs(uint ownedPid) {
      var result = new List<WindowInfo>();
      EnumWindowProc callback = delegate(IntPtr window, IntPtr parameter) {
        uint pid; GetWindowThreadProcessId(window, out pid);
        if (pid != ownedPid || !IsWindowVisible(window)) return true;
        var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
        if (name.ToString() == "#32770") result.Add(new WindowInfo {
          Handle=window.ToInt64(), ClassName=name.ToString(), Enabled=IsWindowEnabled(window)
        });
        return true;
      };
      if (!EnumWindows(callback, IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
      GC.KeepAlive(callback);
      return result.ToArray();
    }
    public static void Click(uint ownedPid, long dialogHandle, long buttonHandle) {
      var dialog = new IntPtr(dialogHandle); var button = new IntPtr(buttonHandle);
      uint dialogPid, buttonPid;
      GetWindowThreadProcessId(dialog, out dialogPid); GetWindowThreadProcessId(button, out buttonPid);
      if (dialogPid != ownedPid || buttonPid != ownedPid || !IsChild(dialog, button) ||
          !IsWindowVisible(dialog) || !IsWindowEnabled(dialog) || !IsWindowEnabled(button))
        throw new InvalidOperationException("Button is not an enabled child of the owned dialog.");
      // Posting avoids blocking this helper when Save opens the OS overwrite prompt.
      if (!PostMessage(button, 0x00F5, IntPtr.Zero, IntPtr.Zero))
        throw new Win32Exception(Marshal.GetLastWin32Error(), "Post owned dialog button click");
    }
  }
}
