// Test-only native dialog interaction. Every HWND is restricted to the exact owned PID.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

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
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint relationship);
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
    public static void ValidateConfirmationOwner(uint ownedPid, long dialogHandle, long saveDialogHandle) {
      var dialog = new IntPtr(dialogHandle); var save = new IntPtr(saveDialogHandle);
      ValidateDialog(ownedPid, dialog);
      uint pid; GetWindowThreadProcessId(save, out pid);
      if (save == IntPtr.Zero || save == dialog || pid != ownedPid || ClassName(save) != "#32770" ||
          !IsWindowVisible(save) || IsWindowEnabled(save) || GetWindow(dialog, 4) != save)
        throw new InvalidOperationException("Confirmation is not owned by the known disabled Save dialog.");
      var dialogs = Dialogs(ownedPid);
      if (dialogs.Length != 2 || Array.FindAll(dialogs, window => window.Enabled).Length != 1 ||
          !Array.Exists(dialogs, window => window.Handle == dialogHandle && window.Enabled) ||
          !Array.Exists(dialogs, window => window.Handle == saveDialogHandle && !window.Enabled))
        throw new InvalidOperationException("Expected only the known Save dialog and its owned confirmation.");
    }
    public static void ConfirmExisting(uint ownedPid, long dialogHandle, long saveDialogHandle) {
      var dialog = new IntPtr(dialogHandle);
      Func<ControlInfo[]> confirmationControls = () => {
        ValidateConfirmationOwner(ownedPid, dialogHandle, saveDialogHandle);
        var controls = Controls(ownedPid, dialogHandle);
        if (Array.Exists(controls, control => control.ControlId == 6))
          throw new InvalidOperationException("Legacy confirmation ID is present; refusing the task-dialog fallback.");
        var roots = Array.FindAll(controls, control => control.ClassName == "DirectUIHWND" && control.ParentHandle == dialogHandle);
        var buttons = Array.FindAll(controls, control => control.ClassName == "Button");
        if (roots.Length != 1 || roots[0].ControlId != 0 || buttons.Length != 2)
          throw new InvalidOperationException("Confirmation does not match the observed task-dialog control tree.");
        var direct = new IntPtr(roots[0].Handle); ValidateControl(ownedPid, dialog, direct);
        var parents = new HashSet<long>();
        foreach (var button in buttons) {
          var handle = new IntPtr(button.Handle); var sink = GetParent(handle);
          ValidateControl(ownedPid, dialog, handle); ValidateControl(ownedPid, dialog, sink);
          if (button.ControlId != 0 || GetDlgCtrlID(handle) != 0 || ClassName(handle) != "Button" ||
              ClassName(sink) != "CtrlNotifySink" || GetDlgCtrlID(sink) != 0 || GetParent(sink) != direct ||
              !parents.Add(sink.ToInt64()))
            throw new InvalidOperationException("Confirmation buttons lack the exact owned task-dialog ancestry.");
        }
        return new [] { roots[0], buttons[0], buttons[1] };
      };
      var selected = confirmationControls();
      var current = confirmationControls();
      foreach (var selectedControl in selected)
        if (!Array.Exists(current, control => control.Handle == selectedControl.Handle && control.ParentHandle == selectedControl.ParentHandle))
          throw new InvalidOperationException("Owned confirmation control identity changed.");
      // Task-dialog button HWNDs have ID 0. Use the documented semantic IDYES,
      // rather than choosing either child by its name or enumeration order.
      UIntPtr result;
      if (SendMessageTimeout(dialog, 0x0466, new UIntPtr(6), IntPtr.Zero, 3, 2000, out result) == IntPtr.Zero)
        throw new Win32Exception(Marshal.GetLastWin32Error(), "Confirm owned existing synthetic destination");
      var deadline = DateTime.UtcNow.AddSeconds(3);
      while (IsWindowVisible(dialog) && DateTime.UtcNow < deadline) Thread.Sleep(50);
      if (IsWindowVisible(dialog)) throw new InvalidOperationException("Owned existing-file confirmation did not close.");
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
      Action verifyFilename = () => {
        UIntPtr readResult;
        if (SendMessageTimeout(edit, 0x000E, UIntPtr.Zero, IntPtr.Zero, 3, 2000, out readResult) == IntPtr.Zero ||
            readResult.ToUInt64() != (ulong)destination.Length) throw new InvalidOperationException("Owned File name length differs from the synthetic destination.");
        var readback = new StringBuilder(destination.Length + 1);
        if (SendMessageTimeout(edit, 0x000D, new UIntPtr((uint)readback.Capacity), readback, 3, 2000, out readResult) == IntPtr.Zero ||
            readResult.ToUInt64() != (ulong)destination.Length || readback.ToString() != destination)
          throw new InvalidOperationException("Owned File name readback differs from the synthetic destination.");
        validateField();
      };
      verifyFilename();
      if (!legacyPresent) {
        // The observed shell picker kept its suggested filename after WM_SETTEXT
        // changed only the Edit. Notify the exact ComboBox parent of the change,
        // using the documented CBN_EDITCHANGE WM_COMMAND shape.
        var combo = GetParent(edit); var sink = GetParent(combo);
        Action validateNotificationTarget = () => {
          validateField();
          ValidateControl(ownedPid, dialog, combo); ValidateControl(ownedPid, dialog, sink);
          if (GetParent(edit) != combo || GetParent(combo) != sink || ClassName(combo) != "ComboBox" ||
              ClassName(sink) != "FloatNotifySink" || GetDlgCtrlID(combo) != 0 || GetDlgCtrlID(sink) != 0)
            throw new InvalidOperationException("Owned File name notification ancestry changed.");
        };
        validateNotificationTarget();
        // A processed WM_COMMAND may return zero; only the timeout API's status
        // establishes delivery. This never sends input to an unrelated window.
        if (SendMessageTimeout(sink, 0x0111, new UIntPtr(5u << 16), combo, 3, 2000, out result) == IntPtr.Zero)
          throw new Win32Exception(Marshal.GetLastWin32Error(), "Notify owned synthetic filename change");
        validateNotificationTarget();
        verifyFilename();
      }
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
