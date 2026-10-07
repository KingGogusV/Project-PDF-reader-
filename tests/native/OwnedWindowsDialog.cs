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
    public sealed class ControlInfo {
      public long Handle { get; set; }
      public long ParentHandle { get; set; }
      public int ControlId { get; set; }
      public string ClassName { get; set; }
      public bool Visible { get; set; }
      public bool Enabled { get; set; }
    }
    delegate bool EnumWindowProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowProc callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowProc callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr dialog, int controlId);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent, IntPtr child);
    [DllImport("user32.dll", SetLastError=true)] static extern bool PostMessage(IntPtr window, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr SendMessageTimeout(IntPtr window, uint message, UIntPtr wparam, IntPtr lparam, uint flags, uint timeout, out UIntPtr result);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr SendMessageTimeout(IntPtr window, uint message, UIntPtr wparam, StringBuilder lparam, uint flags, uint timeout, out UIntPtr result);
    static string ClassName(IntPtr window) {
      var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
      return name.ToString();
    }
    static void ValidateDialog(uint ownedPid, IntPtr dialog) {
      uint pid; GetWindowThreadProcessId(dialog, out pid);
      if (pid != ownedPid || !IsWindowVisible(dialog) || !IsWindowEnabled(dialog) || ClassName(dialog) != "#32770")
        throw new InvalidOperationException("Dialog is not an enabled visible dialog of the owned process.");
    }
    static void ValidateControl(uint ownedPid, IntPtr dialog, IntPtr control) {
      ValidateDialog(ownedPid, dialog);
      uint pid; GetWindowThreadProcessId(control, out pid);
      if (pid != ownedPid || !IsChild(dialog, control) || !IsWindowVisible(control) || !IsWindowEnabled(control))
        throw new InvalidOperationException("Control is not an enabled visible child of the owned dialog.");
    }
    public static ControlInfo[] Controls(uint ownedPid, long dialogHandle) {
      var dialog = new IntPtr(dialogHandle); ValidateDialog(ownedPid, dialog);
      var result = new List<ControlInfo>();
      EnumWindowProc callback = delegate(IntPtr control, IntPtr parameter) {
        uint pid; GetWindowThreadProcessId(control, out pid);
        if (pid == ownedPid && IsChild(dialog, control)) result.Add(new ControlInfo {
          Handle=control.ToInt64(), ParentHandle=GetParent(control).ToInt64(), ControlId=GetDlgCtrlID(control),
          ClassName=ClassName(control), Visible=IsWindowVisible(control), Enabled=IsWindowEnabled(control)
        });
        return true;
      };
      EnumChildWindows(dialog, callback, IntPtr.Zero); GC.KeepAlive(callback);
      return result.ToArray();
    }
    static ControlInfo KnownControl(uint ownedPid, long dialogHandle, int controlId, params string[] classes) {
      var dialog = new IntPtr(dialogHandle);
      var candidates = new List<ControlInfo>();
      foreach (var control in Controls(ownedPid, dialogHandle))
        if (control.ControlId == controlId && Array.IndexOf(classes, control.ClassName) >= 0 && control.Visible && control.Enabled) candidates.Add(control);
      var direct = GetDlgItem(dialog, controlId);
      if (direct != IntPtr.Zero && GetParent(direct) == dialog) {
        var directCandidates = candidates.FindAll(control => control.ParentHandle == dialogHandle);
        if (directCandidates.Count != 1 || directCandidates[0].Handle != direct.ToInt64())
          throw new InvalidOperationException("Expected exactly one enabled direct owned control with the required ID/class.");
        ValidateControl(ownedPid, dialog, direct);
        return directCandidates[0];
      }
      if (candidates.Count != 1) throw new InvalidOperationException("Expected exactly one enabled owned descendant with the required ID/class.");
      ValidateControl(ownedPid, dialog, new IntPtr(candidates[0].Handle));
      return candidates[0];
    }
    public static long Button(uint ownedPid, long dialogHandle, int controlId) {
      if (controlId != 1 && controlId != 2 && controlId != 6) throw new ArgumentOutOfRangeException("controlId");
      return KnownControl(ownedPid, dialogHandle, controlId, "Button").Handle;
    }
    static bool ModernFilenameChain(uint ownedPid, IntPtr dialog, IntPtr edit) {
      var control = edit;
      var classes = new [] { "Edit", "ComboBox", "FloatNotifySink", "DirectUIHWND", "DUIViewWndClassName" };
      for (int index = 0; index < classes.Length; index++) {
        uint pid; GetWindowThreadProcessId(control, out pid);
        if (pid != ownedPid || !IsChild(dialog, control) || !IsWindowVisible(control) || !IsWindowEnabled(control) ||
            ClassName(control) != classes[index] || GetDlgCtrlID(control) != (index == 0 ? 1001 : 0)) return false;
        control = GetParent(control);
      }
      return control == dialog;
    }
    public static void SetFilename(uint ownedPid, long dialogHandle, string destination) {
      if (String.IsNullOrEmpty(destination) || destination.Length > 32767) throw new ArgumentException("Invalid synthetic destination length.");
      var controls = Controls(ownedPid, dialogHandle);
      var dialog = new IntPtr(dialogHandle);
      bool legacyPresent = Array.Exists(controls, control => control.ControlId == 1148);
      var container = IntPtr.Zero;
      var edits = new List<ControlInfo>();
      if (legacyPresent) {
        container = new IntPtr(KnownControl(ownedPid, dialogHandle, 1148, "Edit", "ComboBox", "ComboBoxEx32").Handle);
        foreach (var control in controls)
          if (control.ClassName == "Edit" && control.Visible && control.Enabled &&
              (control.Handle == container.ToInt64() || IsChild(container, new IntPtr(control.Handle)))) edits.Add(control);
      } else {
        // Observed Server 2025 picker: only this exact owned ID/class ancestry
        // identifies its filename edit. Address/search/list edits are excluded.
        foreach (var control in controls)
          if (control.ClassName == "Edit" && control.ControlId == 1001 && ModernFilenameChain(ownedPid, dialog, new IntPtr(control.Handle))) edits.Add(control);
      }
      if (edits.Count != 1) throw new InvalidOperationException("Expected exactly one owned File name Edit with the required ancestry.");
      var edit = new IntPtr(edits[0].Handle);
      Action validateField = () => {
        ValidateControl(ownedPid, dialog, edit);
        if (legacyPresent) {
          if (KnownControl(ownedPid, dialogHandle, 1148, "Edit", "ComboBox", "ComboBoxEx32").Handle != container.ToInt64())
            throw new InvalidOperationException("Owned File name container changed.");
          ValidateControl(ownedPid, dialog, container);
          if (edit != container && !IsChild(container, edit)) throw new InvalidOperationException("Owned File name ancestry changed.");
        } else {
          var current = Controls(ownedPid, dialogHandle);
          var matches = Array.FindAll(current, control => control.ClassName == "Edit" && control.ControlId == 1001 &&
            ModernFilenameChain(ownedPid, dialog, new IntPtr(control.Handle)));
          if (Array.Exists(current, control => control.ControlId == 1148) || matches.Length != 1 || matches[0].Handle != edit.ToInt64())
            throw new InvalidOperationException("Owned File name ancestry became unavailable or ambiguous.");
        }
      };
      validateField();
      UIntPtr result;
      var text = Marshal.StringToHGlobalUni(destination);
      try {
        if (SendMessageTimeout(edit, 0x000C, UIntPtr.Zero, text, 3, 2000, out result) == IntPtr.Zero || result == UIntPtr.Zero)
          throw new Win32Exception(Marshal.GetLastWin32Error(), "Set owned synthetic filename");
      } finally { Marshal.FreeHGlobal(text); }
      validateField();
      if (SendMessageTimeout(edit, 0x000E, UIntPtr.Zero, IntPtr.Zero, 3, 2000, out result) == IntPtr.Zero ||
          result.ToUInt64() != (ulong)destination.Length) throw new InvalidOperationException("Owned File name length differs from the synthetic destination.");
      var readback = new StringBuilder(destination.Length + 1);
      if (SendMessageTimeout(edit, 0x000D, new UIntPtr((uint)readback.Capacity), readback, 3, 2000, out result) == IntPtr.Zero ||
          result.ToUInt64() != (ulong)destination.Length || readback.ToString() != destination)
        throw new InvalidOperationException("Owned File name readback differs from the synthetic destination.");
      validateField();
    }
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
      ValidateControl(ownedPid, dialog, button);
      if (ClassName(button) != "Button")
        throw new InvalidOperationException("Button is not an enabled child of the owned dialog.");
      // Posting avoids blocking this helper when Save opens the OS overwrite prompt.
      if (!PostMessage(button, 0x00F5, IntPtr.Zero, IntPtr.Zero))
        throw new Win32Exception(Marshal.GetLastWin32Error(), "Post owned dialog button click");
    }
  }
}
