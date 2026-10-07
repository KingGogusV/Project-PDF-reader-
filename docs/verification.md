# Verification record

Updated 2026-10-07 UTC. This is a development implementation, not a production-readiness or universal-platform certification.

## Native Save As development verification - 2026-10-07

**Final installed Windows result: passed.** PR [#4](https://github.com/KingGogusV/Project-PDF-reader-/pull/4) implementation head `ce62ae18eb0e8966767c03d6b043d0d420e1f8ba` was tested as merge source `98e199ccbfdc79c916a1d9281f4317990f0e246a`, whose parents are the merged publication fix `0d089eaa42a6a1a58357dc9ce51eccb03e9c99fb` and that exact implementation head. All four fresh affected workflows passed. The following milestone paragraphs retain earlier failures and partial checks; their pending statements describe those earlier attempts.

- [Reader 37615993572](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993572): **84 unit/fixture tests**, zero failures/skips; **88 browser workflows each** on Linux Chromium and macOS WebKit; **seven core/recovery** and **nine signing** cases.
- [Windows/macOS builds 37615993567](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993567): Windows NSIS and macOS app/DMG; formatting, warnings-denied clippy and **19 Windows / 17 macOS Rust safety tests**, with zero failed/ignored cases. macOS packaging is separate from native runtime.
- [Installed Windows 37615993594](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993594): **17 actual installed checks and eight owned OS-dialog interactions** passed on disposable Windows Server 2025 with WebView2 **153.0.4234.48**. This includes cancellation/duplicate requests, explicit backend refusal after OS replacement confirmation, Unicode form Save As, PDF annotations, a **8,390,034-byte / nine-chunk** unchanged PDF, disk hash/independent parse/visible reopen, completed-checkpoint process recovery and confirmed native close. Both owned jobs emptied and executable-scoped test policies were removed; page/console errors and external/unexpected-write observations were zero. Eight release-extraction tests, full installed/build byte identity with only the pinned NSIS marker transformation, strict notices, named payload/checksums and preparation passed. Publication was **skipped**.
- [Published upgrade 37615993616](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993616): **20 checks and four owned launch cleanups** passed using unchanged published installers and isolated synthetic library data. Downloaded evidence artifact `11480490022` matched SHA-256 `25922e76e93f647059234f8726ceb151064e71a05b0355ecbacb4a791229a1dc` and its report names the exact tested merge source.

Independent download verification matched the retained [runtime artifact](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993594/artifacts/11480781752) SHA-256 `53bedcc6f8a6f749c9a3bef3c7f2bcf14d14b054f8db08056963f7b3f096ac52` and [prepared payload artifact](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37615993594/artifacts/11480411734) SHA-256 `131f44b5092c0e83066f8883c890dd002d04ac7ef7dd1acdb1da4897f8b9cb82`. Bounded flat extraction, every payload size/hash, provenance source/run, checksum file, exact notice archive inventory and **551 manifest-referenced hashes** including all **five MPL source archives** passed. The **554 notice files** contain 234 crates, 113 original license texts and 24 platform files. Independent parsing confirmed retained form values/unrelated fields, FreeText content and original-byte prefixes. Retained native recovery screenshots show the Save As control and readable restored form values. Full hashes and check names are in the [sanitized machine-readable record](native-save-verification-2026-10-07.json).

The large output bytes are not retained in the runtime ZIP; its exact-byte/hash/parse/reopen assertions ran in the actual installed harness. The reported minimum nine chunks follows from output length and the fixed 1 MiB production/backend bounds, rather than separately retained per-chunk telemetry. The report's initial debugger polling note `lastConnectError: fetch failed` predates successful connection; both verified launches and final runtime passed.

This delivers a tested development change; PR #4 remains open and no new release, tag, asset or website deployment was published. A following documentation-only record commit changes no tested application/build/test inputs and is not claimed to have independently passed CI. Local final Edge/unit/Rust results, local policy limitations, physical disk-full injection boundaries and retained temporary directories are recorded below and in the machine-readable record.

Development branch `codex/native-safe-copy` starts from merged publication fix `0d089ea`. The shared PDF controller, library schema, website accounts and existing browser download acknowledgment are retained. Native reader output now uses an OS Save As dialog and a Rust-owned new-copy transaction; a matching disk filename/length/SHA-256 receipt acknowledges only the captured export revision. Cancel/error retains edits and refuses racing open/save/close. Existing destinations are always refused, even after the OS replacement prompt; original bytes are never overwritten.

Initial local implementation results: TypeScript/production build; **79 unit/fixture tests with zero failures/skips**; **88 Edge browser workflows**, including **12 simulated native save/close cases**. After the final header-tolerance adjustment, the rebuilt production app again passed the focused 12 cases. Rust `cargo check --locked`, `cargo test --locked` (**19 tests, zero failed/ignored**), clippy with warnings denied and formatting passed. Rust cases include real write/read/flush/delete failures, destination races, stale/reloaded transactions, Unicode filenames and a **150 MiB streamed disk roundtrip**. Disk-full handling is tested through an injected short write and `StorageFull` error; the physical disk was not filled. That roundtrip tests bounded transfer and byte integrity, not application capacity or speed. Review of Cargo resolution found 18 new package entries and no existing versions changed/removed; PDF engines and JavaScript dependencies are unchanged.

Fresh [Reader CI 37598572369](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37598572369) passed on implementation `e069999` (tested merge `4ed4f3d`): 79 unit/fixture cases with zero failures/skips and 88 browser workflows each on Linux Chromium/macOS WebKit; the unchanged core seven and signing nine cases passed. [Published upgrade CI 37598572570](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37598572570) passed all 20 checks and four owned process/policy cleanups against the unchanged published installers. Its downloaded evidence ZIP matched SHA-256 `21cbe40b363bd5f26dec332035d773de1f0c4a07a0736288dcbfb13621a07f0a` (artifact `11471542371`).

Initial local core/signing development-harness runs timed out while Vite served HTML/worker modules; traces show requests stalled before document assertions. Concurrent production E2E cleanup also removed nested trace outputs. A sequential core retry with isolated output and a 120-second local timeout still stalled, then was interrupted; signing retry was not started. A bounded isolated-cache diagnostic also stalled. All owned diagnostic processes were closed; assertions/configuration remain unchanged. The underlying Windows/Vite cause is unconfirmed; the complete supported Linux CI suite passed as recorded above.

Local frontend/optimized Rust compilation and Windows NSIS installer creation passed (`pnpm native:build --no-sign --bundles nsis -- --locked`); Cargo lock hash stayed `65164ebfafa84bcf9d0921ea308edbc1d90fc1685c0a7e53b34e1a150855a3d9`. The 14,153,945-byte development installer SHA-256 is `684f17fa101f3a35edae406f771b298e10fa7f6c18e42b0eb9acb0b6d74bb22b`. It was not installed/published and does not include separately generated native-distribution notices. The first [Windows gate 37598572411](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37598572411) correctly stopped at notice collection: three new Tauri plugin crates needed original MIT text and three new Windows crate versions needed exact reviewed clarification guards. Installation/runtime were skipped.

The notice correction passed the strict local collector: **234 crates, 113 original license texts and five unchanged MPL archives**, with the Cargo lock unchanged. Dialog/fs `LICENSE_MIT` archive bytes match their published source revisions and SHA-256 `89ff9689dcf9dd53968785d05a26f7898bb169dbfcada8d032b3e68cf0d55607`; tauri-plugin's omitted workspace-root text is pinned to published revision `30da1fd6e17de6107ecc850c95dfb16b5729f2dd` and SHA-256 `9dd42ea92cff2ede5cd477cbfcce051b2d0115c0ac7f368ee88cb545055dff1d`. The three Windows versions retain the existing original Microsoft text hash. A separate review compared all six crate archives/VCS metadata and official source texts. SPDX allowances and fallback refusal are unchanged. Notice-bundled installation/runtime and fresh Windows gate retry remain pending at this milestone; no runtime pass is inferred from simulated IPC or compilation.

The corrected notice-bundled local NSIS installer also built: **18,019,693 bytes**, SHA-256 `4f9001d2c584c683012a705c3aeb5c364733aac1617925e147560765fd839797`. A normal, non-elevated temporary installation passed full installed/build byte comparison with only the reviewed three-byte NSIS marker change, plus **all 554 installed notice file hashes**. WebView2 **154.0.4258.62** passed nine real reader/storage/search/OS-close-cancel checks. The first Save As automation call then failed with `windows-save-dialog.ps1 cannot be loaded because running scripts is disabled on this system` in Windows PowerShell 5.1. That shell's policy scopes were all undefined (default Restricted); PowerShell 7 separately reports RemoteSigned. Policies were not changed or bypassed. This is partial local runtime evidence, not a Save As pass. Owned process cleanup and guarded uninstall passed; the exact temporary EXE and registration were removed and no Folio process remained. The private synthetic profile is retained only for diagnosis. User PDF library/default installation were not used.

Corrected source `048f53b` also passed fresh [Reader 37600029185](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37600029185), [Windows/macOS packaging plus Rust 37600029155](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37600029155) and [published upgrade 37600029252](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37600029252). [Installed Windows 37600029037](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37600029037) passed strict notice collection, eight extraction cases, compilation/NSIS, 19 Rust cases and clippy, then nine real installed checks. The Save As helper failed before interaction because Windows PowerShell 5.1 did not find `Get-FileHash`; the next correction preserves executable identity rather than suppressing that guard. Native evidence artifact `11472523722` retains the failure; publisher stayed skipped. OS dialog writes/receipt/reopen are still pending at this milestone.

The helper correction uses streamed .NET SHA-256 and retains all process/session/path/reparse/exact-hash guards. The actual Node-spawned Windows PowerShell 5.1 child reproduced the missing cmdlet, then passed parser checks, all 12 other required cmdlets, UIAutomation assembly loading, C# compilation and an independent Node-vs-.NET digest comparison. No execution policy was changed or bypassed. Full runtime must still pass fresh CI.

The nine-check normal-user installation above predates the native CSP correction and is partial evidence for that earlier build. Its runtime log and install/uninstall/binary-identity records remain in the ignored cache. A later standard E2E output cleanup removed the original detailed local runtime report/screenshots; they are not cited as retained evidence. Downloaded CI evidence and owned probe records remain separate.

Source `defdd7ab` passed fresh [Reader 37602092928](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37602092928), [Windows/macOS packaging plus Rust 37602092765](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37602092765) and [published upgrade 37602092875](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37602092875), tested as merge `64f9816`. Upgrade artifact `11472634320` was downloaded and matched SHA-256 `7035c2851b3e004d59061fd924f61e6683c50140862001afcf0c5505e5526abe`; its 20 checks passed. [Installed Windows 37602092673](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37602092673) passed packaging, notices, extraction, Rust and nine installed reader/close checks, then failed before the first Save As interaction. Diagnostic artifact `11473992077` matched ZIP SHA-256 `c457108d5b16e5d66b2828b8daac90052de94f8361f724a1ee797546e5a2b8e2`: the unchanged HTML metadata CSP blocked `http://ipc.localhost/begin_pdf_save` despite the native configuration's IPC allowance. Separately, a synchronous helper can stall Playwright's local-IPC route processing while waiting for a dialog. The next correction keeps browser CSP unchanged, permits only Tauri's two local IPC sources in native HTML/headers, and awaits an asynchronous owned-dialog helper. No runtime pass is inferred from this failed attempt; owned cleanup passed and publication was skipped.

Preservation audit confirmed both prepared commits remain ancestors of main/current branch; `sources/`, the document core, features, account/storage schemas, package manifest and JavaScript lockfile remain unchanged. Both public release records and all eight assets exactly match the pre-pass inventory (IDs, tags, source targets, URLs, sizes, hashes and timestamps). After local uninstall, a hash-checked residual uninstaller file was removed safely. Automatic approval review rejected deleting the task-owned directories, including the now-empty install directory, with `blocked by policy`. The synthetic WebView profile/copy directory and empty install directory remain; no running app, registered installation or user-profile changes remain. Diagnostic reports are retained in the ignored workspace cache/test-results.

Save output is capped at 256 MiB in 1 MiB binary chunks; reader input remains capped at 150 MiB. Normal cancellation/error explicitly removes temporary files and surfaces cleanup failures. Unexpected process termination/page unload may leave an unpublished `.folio-save-*.tmp`; pending edits without a completed checkpoint can be lost. Final-file flush/readback is not a universal power-loss guarantee. macOS native runtime, manual Open-dialog navigation, physical printing and tool-specific native output remain unverified/out of this focused pass. Published releases and website deployment are unchanged.

The native-only CSP correction passed all **84 unit/fixture tests with zero failures/skips**, including five policy/integration regressions. Browser/native/browser-restoration production builds and type checking passed. The restored browser index is byte-identical to its pre-correction output (SHA-256 `e73b792eb2e1d1e857c2d616fbc98ca9454e11beccbe091d7b693e7a03494a3a`); native metadata SHA-256 `84ff325c35146e7deac235add49af23fc6faba24b809dc704417d2e6eb384298` differs only by the two configured local IPC sources. The Vite object-export contract used by signing remains compatible. An independent review checked browser policy, native scope and asynchronous helper ownership/error bounds. Fresh installed runtime is still required after this correction.

Source `911bd15` (tested merge `1d3b287`) passed fresh [Reader 37605138236](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37605138236), [Windows/macOS packages and Rust 37605138259](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37605138259) and [published upgrade 37605138334](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37605138334). Local Edge again passed all 88 workflows. Upgrade evidence `11473774964` matched downloaded ZIP SHA-256 `b488be8f31d1f2562b5015fbc99255f368398af16202cdffad9061c3cddbfaf9`, with 20 passing checks and four clean owned launches. [Installed Windows 37605138438](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37605138438) reached the real owned Save As chooser; both structural inspections and duplicate save/open/OS-close guards passed, establishing that the native CSP correction reached the dialog. Cancel then failed because UI Automation exposed Explorer virtual controls but omitted the standard buttons/filename field. Diagnostic evidence `11474653748` matched SHA-256 `5d8d9b458064d61fe1fb576744df1e279d36c33957236aca1a6bbaac62efa750`; CSP/page errors were empty and process/policy cleanup passed. The next test-helper correction uses exact owned Win32 control IDs with PID, child, class, visibility, enabled-state and ambiguity guards, plus filename text readback; it captures no control names/values and uses no global input. Full cancellation/write/reopen verification is still pending at this milestone. Publication stayed skipped.

The owned-control fallback passed Windows PowerShell 5.1 syntax/assembly compilation and an offscreen, non-activating task-owned Win32 fixture: Unicode filename/readback, direct/nested standard controls, and refusal of wrong PID, unrelated child, disabled/wrong-class and ambiguous controls. Independent review required full text-length/count and exact case-sensitive readback, and visible/enabled UIA action targets. All prior identity/path/ownership guards, timeouts and passing criteria remain intact. Application source and permissions are unchanged by this helper correction; actual installed cancellation/write/reopen must still pass fresh CI.

Source `470e4637` (tested merge `5eaaf625`) passed fresh [Reader 37607970265](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37607970265), [Windows/macOS packages and Rust 37607970266](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37607970266) and [published upgrade 37607970303](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37607970303). Results were 84 unit cases with zero failures/skips, 88 workflows per browser, seven core and nine signing cases, 19 Windows/17 macOS Rust cases, formatting and clippy. Upgrade artifact `11475159774` matched downloaded ZIP SHA-256 `5c69e597649ca6257b532e4cc0a4bb4fa4c760bb4e1046f4af39aee273c91c40`, with 20 passing checks and four clean owned launches. [Installed Windows 37607970241](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37607970241) passed real cancellation and duplicate save/open/OS-close protection (ten checks total), then the helper safely refused a missing legacy filename control 1148. Runtime evidence `11477100838` matched downloaded ZIP SHA-256 `cafc183b374f0fe70e2d4151a78fbd0b01a2eebecc995ffdf9ebbcdf87442488`: the modern dialog exposes a unique visible Edit 1001 inside the observed ComboBox/FloatNotifySink/DirectUIHWND/DUIViewWndClassName parent chain. The next helper correction restricts fallback to that exact owned structural chain when legacy 1148 is absent. Console/page errors were empty, owned cleanup passed and publication was skipped. Full write/receipt/reopen verification remains pending at this milestone.

The modern filename mapping passed the same offscreen, non-activating owned Win32 fixture with both legacy/modern Unicode fields and refusal of wrong ancestor class/ID, hidden or disabled ancestors, ambiguous chains and any present unusable legacy field. It re-enumerates exact ancestry, uniqueness and legacy absence before/after setting and after bounded case-sensitive readback. Application code and permissions are unchanged; real installed write/receipt/reopen remains a required fresh gate.

Source `320229cd` (tested merge `d5a09612`) passed fresh [Reader 37610271625](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37610271625), [Windows/macOS packages and Rust 37610271591](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37610271591) and [published upgrade 37610271588](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37610271588), with the same 84/88-per-browser/seven-core/nine-signing and 19-Windows/17-macOS results. Upgrade artifact `11477541739` matched downloaded ZIP SHA-256 `0290f72bf0c0792ca7dd7c00b9c04003bd26cf37f3de93f1f900392c743d6ed4`, with 20 passing checks and four clean owned launches. [Installed Windows 37610271900](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37610271900) again passed ten checks, then the modern field helper's visible text readback succeeded but the shell returned its default `form-folio.pdf` name instead of the intended existing destination. The app acknowledged that actual OS-selected new copy; waiting for the expected overwrite prompt then failed. Runtime artifact `11477214033` matched downloaded ZIP SHA-256 `7eb7d1c1e97327fb5fe802f35065daac764a79251cc50124d9c76139bb9acc16`. The default copy's directory is not exposed in the sanitized report and was not guessed or deleted; this failure occurred only on the disposable CI runner. Page/CSP errors were empty and owned process/policy cleanup passed. The next helper correction sends only the documented filename ComboBox notification to its verified immediate owned parent, then repeats exact readback. The existing-file expectation is retained; full write/receipt/reopen remains pending at this milestone. Publication stayed skipped.

The modern notification correction passed Windows PowerShell 5.1 compilation and the offscreen owned-window fixture: visible text alone leaves the independently observed filename model stale; the exact ID/code/ComboBox-handle event updates it to the Unicode destination; wrong sender/sink/ID is refused. All prior chain/ownership/visibility/ambiguity negatives remain passing. Application code and permissions are unchanged; the actual shell's response is still a required fresh installed gate.

An additional independent probe used a real native Windows ComboBox 0 and its actual Edit 1001 child in a task-owned offscreen window. `WM_SETTEXT` updated Edit/ComboBox text but emitted no change notification and left the independent cached model stale. The exact immediate-parent `WM_COMMAND`/`CBN_EDITCHANGE` event updated that model; wrong ID/sender did not. `EM_REPLACESEL` also produced the normal edit-update/change notifications. Foreground state was unchanged and all fixture windows were destroyed. This verifies the control contract without bypassing the local Save As script policy; real shell/runtime verification remains separate.

Source `c19ab08b` (tested merge `c4336374`) passed fresh [Reader 37612831709](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37612831709), [Windows/macOS packages and Rust 37612831704](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37612831704) and [published upgrade 37612831640](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37612831640), retaining all prior 84/88/seven/nine and 19/17 results. Upgrade artifact `11478384883` matched downloaded ZIP SHA-256 `131e69e063a027a0a00116191aa1692efc5bb233e5db495405e66d180619ac4b`; all 20 checks and four cleanups passed. [Installed Windows 37612831665](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37612831665) passed ten checks and reached the real overwrite prompt, proving that the filename notification selected the intended existing path. Confirmation then failed safely: UI Automation exposed no button at its immediate snapshot, while the two native buttons both had control ID zero. Runtime artifact `11479386975` matched downloaded ZIP SHA-256 `40d31a83be41f89e96ab3ac4b5ac3fe93b4ee5cbc6a64085b58d7033ce48f9ca`. The original Save dialog was disabled and a sole owned confirmation dialog was enabled. Page/CSP errors were empty and owned cleanup passed. The helper must use documented semantic confirmation with exact prior-Save linkage rather than choosing an ID-zero button by order/name. Full write/receipt/reopen remains pending at this milestone; publication stayed skipped.

An independent real native TaskDialogIndirect probe used offscreen task-owned windows and common-controls v6. Its visible enabled prompt was owned by the exact visible disabled `#32770` parent, with the observed DirectUIHWND/two CtrlNotifySink/Button branches and no physical ID 6. Bounded `TDM_CLICK_BUTTON`/IDYES 6 produced callback/result 6 and destroyed the prompt. Foreground state was preserved and both windows were destroyed. The test helper now links confirmation to the preceding synthetic Save HWND, revalidates ownership/structure and requires prompt disappearance; it also requires Folio's explicit existing-file refusal message rather than treating cancellation as refusal. No application code, permissions or execution policy changed. The full installed runtime remains the required fresh gate at this milestone.

## Publication fix delivered - 2026-10-07

PR [#3](https://github.com/KingGogusV/Project-PDF-reader-/pull/3) was updated by a non-forced fast-forward containing both prepared commits `de1b19bc7f7bfa53d65cde9a6b16209685a8e328` and `cdecc8ed9f02e5177c67da1a11fb295e2ca87479`, then merged with preserved history as `0d089eaa42a6a1a58357dc9ce51eccb03e9c99fb`. All fresh PR workflows passed on `cdecc8e`: [Reader 37594932642](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37594932642), [Windows/macOS packages 37594932574](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37594932574), [installed Windows verification/preparation 37594932558](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37594932558) and [published upgrade preservation 37594932633](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37594932633). Publication was skipped. The earlier blocked-session record below is historical.

Fresh local Windows baseline: 70 unit/fixture cases with zero failures/skips; eight extraction cases; TypeScript and publisher syntax checks; production client/worker build; 79 Edge browser workflows; `cargo check --locked` and `cargo test --locked` compiled and linked successfully (the baseline contained no Rust unit cases). Access checks confirmed PowerShell location, repository/Git writes, HTTPS Git fetch/push, authenticated `KingGogusV` admin permission and supported PR mutations. Effective session: danger-full-access, approval policy never, networking enabled. No credentials were printed.

Actual prerequisites are now Rust/Cargo 1.99.0, Node 24.19.0, pnpm 11.25.0, MSVC 14.51.36231 in Visual Studio 18 Insiders, Windows SDK 10.0.26100.0 and WebView2 154.0.4258.62. The first `vswhere` probe omitted prerelease installations and missed MSVC; actual compiler/linker success and a subsequent `-prerelease` probe corrected that result. Existing compiler/SDK versions were retained; rustfmt and clippy components were added to the installed Rust toolchain for required checks. Public release identity and website delivery remain unchanged.

## Release publication safeguards - 2026-10-07

Local verification passed 70 unit/fixture cases (zero failures/skips), including seven publication-policy cases, plus all eight hostile-release-extraction tests, TypeScript checks and publisher syntax checks. The workflow parsed as YAML with unique keys; a static check covered eight publication-condition cases, ten push-path cases and read/write permission separation. This checks the condition's simple equality/conjunction subset, not a full GitHub Actions emulator. CLI regressions use a network trap: push/PR/default/stale dispatch requests fail before any API call; an explicit request with a conflicting immutable tag stops at the first read-only tag check. The first Windows CLI test attempt exposed an ESM path issue in the new test's preload argument; using a file URL corrected the harness, then all tests passed.

Automatic installer verification is retained; ordinary documentation-only main pushes do not match its paths. Manual dispatch defaults to verification only. Publication requires an explicit main request with `publish=true` and an exact full `expected_source_sha`; the publisher independently validates the event payload. Existing Reader/native/binary/notice/artifact/checksum gates remain mandatory. Remote CI and PR merge are pending at this record's implementation milestone; subsequent results will be recorded separately. No new release or website deployment is required for this automation/test-only change.

The follow-up session successfully executed PowerShell and confirmed local repository file write/read/remove access. It inspected the clean prepared commit `de1b19bc7f7bfa53d65cde9a6b16209685a8e328` (tree `359bd2cc479126624af604d65c6cdc32b5411f0b`) without rebuilding the fix. Node 24.19.0 reran all 70 unit/fixture tests with zero failures/skips (5669.7493 ms), eight extraction tests (1.010 seconds), type checking, three syntax checks and the same eight-condition/ten-path static workflow checks. These durations describe suite execution, not application performance.

Delivery remains blocked: the connected GitHub account is `KingGogusV` with admin/write repository permission, but both `GitHub create_tree` (uploading the reviewed tree) and `GitHub update_pull_request` (updating PR #3's title/body) returned `MCP tool call requires approval, but approval policy is never`. This session provides no approval escalation flow. Direct `git ls-remote` returned `fatal: unable to access 'https://github.com/KingGogusV/Project-PDF-reader-.git/': Failed to connect to github.com port 443 after 66 ms: Could not connect to server`. No remote branch or PR description was updated. A final read confirmed PR #3 remains open/unmerged at `5ac4a1c1ed7dcbe0432de27f4248df30fa1e0736` and main remains `b9e3c6a8c59568a8a9e1a594dd21af5e8b17cde9`. Both existing release tags and all eight release assets' IDs, sizes, digests and update timestamps are unchanged. No website deployment was attempted.

The prepared commit and its ancestor milestones are preserved. Push the reviewed fix to the PR branch with a non-forced fast-forward after rechecking remote history, revise the PR description, then require successful affected CI before merging. Do not merge the old PR head until the publication fix is included. No new remote CI or merge success is claimed. [Follow-up evidence](windows-publication-policy-verification-2026-10-07.json) records completed checks and exact blockers; the prepared final-scope PR description is retained locally in the ignored handoff directory.

## Published Windows upgrade preservation - 2026-10-07

[Run 37583640160](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37583640160) passed **20 checks** for PR head `0e56b6b11b912a9f044f568c32b67515d3a3984f`, tested merge `19080312d057514438327a4cfb8e26051cbff3a0`. Actual published installer/executable hashes matched provenance. Three synthetic guest PDFs retained originals, two unexported form/annotation checkpoints, complete records and durable preferences. All three visibly reopened and exported exact stored bytes; another full restart retained them. Owned jobs, exact CI policy values and uninstall registration/executable cleanup passed.

Environment: elevated disposable Windows Server 2025 10.0.26100, Node 24.21.0, WebView2 153.0.4234.48, isolated overridden profile. Total workflow **35.408 seconds**, including installations, four launches and cleanup; not a device-speed benchmark. Downloaded artifact `11465332072` matched ZIP SHA-256 `28d4646b23e74af35dd7d41666e4d10eb77748f7a326057670ea51c496f1e29a`. A second pass compared downloaded stores and parsed exports, including page sizes/rotations and persisted edits. Native annotation and 320-pixel browser screenshots were inspected.

Local Windows 10.0.22621.0/Edge 154.0.4258.62: type checking, 63 unit tests with zero skips, production client/worker builds and 13 accessibility/responsive cases passed. The owned preview was stopped explicitly after automatic teardown stalled; the suite exited 0. Cached dependencies were invoked directly because pnpm attempted a noninteractive purge. Native CIM inspection returned Access denied; the preflight refuses installation under that restriction. The earlier owned partial installation was uninstalled; zero Folio processes remained.

One earlier run lost its newest recent-file entry during abrupt pre-upgrade termination; PDF stores survived. The passing check compares confirmed durable 0.1.0 state. Real default Windows 11 profiles, physical printing/mobile, macOS native runtime and assistive technology remain separate gaps. [Structured evidence](windows-upgrade-verification-2026-10-07.json) retains boundaries and failures. Public deployment/releases are unchanged.

The same PR head also passed [Reader CI 37583640162](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37583640162): 63 unit cases with zero skips per platform, 79 Linux Chromium and 79 macOS WebKit browser cases, seven core cases and nine signing cases. [Native packaging 37583640157](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37583640157) passed Windows/macOS builds. [Windows preview gate 37583640154](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37583640154) passed its installed-reader job; publication was skipped because this is a PR. Later documentation-only commits do not change tested application or harness inputs.

## Accessibility pass and published delivery, 2026-10-03

[Windows preview v0.1.1-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.1-preview.1) is published from source `8b9f1683bf0c47b9c8b2da4d638168c4a1e3b00f`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T18:05:44.007570+00:00. The unsigned Windows x64 installer is 17,854,309 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162439) passed installation, 14 native workflows, exact-byte NSIS identity, cleanup, notices and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162437) passed 63 unit tests with zero skips, 79 E2E workflows each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native builds](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37142162471) passed on Windows and macOS.

Download [Folio-0.1.1-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.1-preview.1/Folio-0.1.1-Windows-x64-Setup.exe). Installer SHA-256: `32e7484d4ec716a513ff09ff86c85f3a4ac4f690be9c6d7e5b56c5b70d5a6be2`. [Public asset evidence](windows-preview-2-verification.json) records all downloads and confirms the old 0.1.0 tag/assets remain unchanged. [Accessibility evidence](accessibility-verification-2026-10-03.json) records both browser audit summaries, merged/deployed source identities and the manual acceptance boundary. PR #2 was merged with all implementation milestones preserved.

Website v4 succeeded at the existing public URL, with application code identical to the release tree. Local production verification passed all 79 Chromium workflows; merged-source CI passed 79 each on Linux Chromium/macOS WebKit, with no flaky cases. The 15 axe states on both audited engines had zero violations; incomplete contrast findings remain manual work. Six standard viewport classes, 320-pixel reflow, 200% text and forced colors were visually reviewed; macOS screenshots were separately inspected.

The final shell JavaScript is 79.62 kB (25.90 kB gzip), versus 76.69 kB (25.02 kB gzip) at the prior release; CSS is 253.26 kB (47.18 kB gzip). No new runtime dependency was added. These are build-size measurements, not startup or physical-device benchmarks. Physical screen readers/devices, branded Safari, macOS native runtime, existing-profile Windows upgrades and physical printers remain unverified. The new Windows runtime evidence is CI-only; the earlier normal-user result below applies to 0.1.0.

## Earlier Windows 0.1.0 preview and QA, 2026-10-03

[Windows preview v0.1.0-preview.1](https://github.com/KingGogusV/Project-PDF-reader-/releases/tag/v0.1.0-preview.1) is published from source `61adbfd1c9d582e1203606052c2443270f689366`. All four public assets were downloaded without credentials and their sizes, SHA-256 values, provenance and tag identity verified at 2026-10-03T12:15:32.087Z. The unsigned Windows x64 installer is 17,844,743 bytes. [Release CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666280) passed actual installation, 14 native checks, exact-byte NSIS identity, notice collection and publication. [Reader CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666271) passed 63 unit tests with zero skips, 66 E2E cases each on Linux Chromium/macOS WebKit, seven checkpoint cases and nine signing cases. [Native build CI](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37121666305) built both Windows and macOS packages.

Public download: [Folio-0.1.0-Windows-x64-Setup.exe](https://github.com/KingGogusV/Project-PDF-reader-/releases/download/v0.1.0-preview.1/Folio-0.1.0-Windows-x64-Setup.exe). Installer SHA-256: `ad33d489e9f317965b40fbc3ad473ddaa2883e503e8bd4c46e30c756414120ac`. The release is a development preview, not production certification. [Machine-readable public verification](windows-preview-1-verification.json) records every asset and hash. PR #1 was merged preserving its milestone commits; later documentation-only changes do not alter the released application.

The exact anonymously downloaded public installer was installed and passed all 14 native checks in a normal, non-elevated Windows build 22621 session at 12:16:20–12:16:31 UTC with WebView2 154.0.4258.53. This includes actual OS-close cancellation/discard, native PDF export/reopen and completed-checkpoint recovery after process termination. Both owned process jobs emptied; no local registry policy was changed. All 533 installed native notice hashes passed. Sanitized local evidence is included in the machine-readable record above. CI uses WebView2 153.0.4234.48. The final main browser runs had 66 passes each with no flaky marker; the earlier macOS OCR page crash remains recorded and is not considered resolved by subsequent passes.

Local preview at `http://127.0.0.1:4173/` returned HTTP 200 with its CSP header. Live website v3 guest storage/recovery, phone layout and genuine Chromium-offline reopening passed at 11:40:57 UTC. No document uploads or page exceptions were observed. No website republish was needed for the native-only close/release changes.

Performance boundaries at the 0.1.0 checkpoint: that production build has 76.69 KB initial JavaScript (25.02 KB gzip), and 225 required offline assets total 8.07 MiB. The recovered one-page native synthetic form reported 147 ms to first page in the public-installer warm recovery run; this is not a cold-start distribution or physical-phone benchmark. Earlier measured large-page-count fixtures are retained below.

Remaining external verification: complete managed account sessions, branded Safari/macOS native runtime, physical iOS/Android, printers and comprehensive assistive technology. Device storage remains unencrypted and nonsynchronizing; 200 is a registration ceiling, not a concurrent-user result.

## Historical native close-safety correction, 2026-10-03

The close correction passed 14 actual installed Windows checks both in CI (run 37120364964, WebView2 153.0.4234.48) and a normal local session (WebView2 154.0.4258.53), including cancel-preservation and confirmed clean exit. The remaining release checksum mismatch was reproduced: Tauri patches only its three-byte NSIS marker and restores the unpatched build file. The strict comparator now verifies that exact transformation and every remaining byte; At that stage revised release validation and publication were pending; both subsequently passed as recorded at the top.

- Source `20b1f48e6a980a5b70cc3cfe41dad9828bb3e19a`: Reader run [37118654848](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654848) and both native build jobs [37118654865](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654865) passed.
- Release run [37118654858](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37118654858): native WebView2 153.0.4234.48 passed 12 checks at 11:15:42-11:15:54 UTC; prepare failed, publisher skipped. Both jobs emptied and exact test policy was removed. Evidence archive SHA-256 `9960786ae9012f2ae5bb0aa6758ed51dc0da5da3e8d14ecc6168d3a3c822dd2b`.
- Negative normal-user check at 11:11:33-11:11:37 UTC, source `85cc5de6378e64372549fb298d383374c74a488a`: real OS close exited zero without an unsaved-form prompt. Prior 12-check passes did not cover OS close.
- Local correction: typecheck and production build passed (manifest `6242986adc1c8c29`); 59 unit tests passed, zero skips, 6.08 seconds. All three shared-UI close tests passed in Edge (6.0 seconds), and all six responsive viewport classes passed (12.3 seconds). The first background-tab attempt requested close while the second PDF was still opening; the app correctly refused, and the test now waits for opening to finish. Rebuilt native verification subsequently passed all 14 cases locally and in CI; see the evidence below. Browser tests simulate only the native bridge and are not native close evidence.

## Historical normal-user Windows verification, 2026-10-03

Actual Windows 10.0.22621 x64 / WebView2 154.0.4258.53 verification on 2026-10-03 passed 12 native checks: startup, real rendering, storage refusal/consent, immutable originals, form recovery, search, form download/reopen, text annotation download/reopen, and recovery after full owned-process termination/relaunch. Both process jobs emptied; the normal-user route changed no registry policy. The tested installer came from artifact 11266978801, source `85cc5de6378e64372549fb298d383374c74a488a` (installer SHA-256 `48e755d2e3a9596981a11c0a914ae514455ec533e82eb0e8201e65e219da8c31`). All 533 installed notice hashes also passed.

At this earlier 12-check stage, public Windows publication was pending the later close-safety/release validation. The existing hosted custom-account failure does not reproduce in the normal Windows user session.

Initial expanded-test attempts exposed test-only path joining and plain-array parsing mistakes; neither was marked passed. Corrected full verification passed at 10:57:34–10:57:43 UTC, followed by a final launcher rerun. Evidence is summarized in [native-windows-2026-10-03.json](native-windows-2026-10-03.json). File selection was automated through the real HTML input; physical picker/printing and other devices are not established by this result.

## Historical verification: reader correction and Windows release gates

The corrected reader is now live in **deployment v3**. Its complete Linux Chromium
and macOS WebKit CI passed, and the hosted forced-GC Ink regression passed.
The previous custom-account CI runtime failed; subsequent normal-user Windows native checks passed. The later revised runtime gate passed; close-safety/release validation and public publication were still pending at this stage. Earlier results below remain
evidence for their stated source revisions; they are not erased by later passes.

### WebKit editor lifecycle correction

[Reader run 37098740604](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37098740604)
at PR head `6c0c5d999b615607d918eb6baad99b2950d8e887` exposed a real error in the
macOS WebKit job: **62 passed, one failed**, including a failed retry of the Ink
case. The exact uncaught exception was
`null is not an object (evaluating 'e.#n.isCancellable')`. A stale PDF.js pointer
listener threw when Export was pressed after switching to Select. Export/reopen
assertions still completed, but the strict exception assertion correctly failed
the workflow.

Local reproduction with Playwright 1.63.0 WebKit 26.6 build 2359 on Windows forced
garbage collection during a live stroke. The engine collected a composite
`AbortSignal.any()` needed to remove drawing listeners on abort. The controller
now retains only its own editor manager's live composite signals until abort or
document destruction. The regression adds `page.requestGC()` during the existing
Ink workflow and retains its exception, original-byte, PDF-annotation and fresh
reopen assertions; no exceptions are suppressed.

| Correction verification | Verified result |
| --- | --- |
| Forced-GC Ink regression against the unpatched production app | One failed with the exact CI exception |
| Same regression against the corrected production bundle | Three passed |
| Windows Edge editor workflows | Six passed; 12.5 seconds |
| Windows WebKit editor workflows | Six passed; 19.3 seconds |
| Typecheck and full production client/Worker build | Passed; manifest `4336354ebff242c2` |
| Unit/fixture tests on the local corrected source | 55 passed; zero skips |
| Corrected-source macOS WebKit CI | 63 passed; 3.0 minutes, run 37102794616 |
| Hosted v3 Windows WebKit forced-GC Ink regression | One passed; 6.1 seconds, with real PDF export/reopen |

The six browser cases cover forms, free text, text-highlight undo/redo, Ink under
GC, freehand highlight and canceled dirty close. They retain independent output
inspection, original-prefix preservation, reopen checks and zero external
requests/page exceptions. These scoped local checks preceded the full corrected-source
CI below. Deployment v3 now uses the same manifest `4336354ebff242c2`; none of
these tests certify physical Safari or Apple devices.

### Corrected-source CI and packaging

[Reader run 37102794616](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794616)
**passed all three jobs** for the v3 reader source. Typecheck, production build and
unit/fixture checks passed; Linux Chromium passed **63 E2E cases in 2.3 minutes**,
macOS WebKit passed **63 in 3.0 minutes**, controller checkpoints passed **7 in
12.3 seconds**, and signing-core checks passed **9 in 12.7 seconds**. These are
suite execution times, not document performance measurements. The previously
failing Ink workflow now forces GC during a live stroke and retains strict
exception/export/reopen checks.

[Native packaging run 37102794636](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794636)
**passed on both Windows and macOS** for the updated source. This establishes
compilation and unsigned package creation, not native PDF runtime correctness or
a public release. GitHub implementation `85cc5de6378e64372549fb298d383374c74a488a`
and its matching hosted source/tree are recorded in the hosting section below.
[PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1) was still open at this stage; its later merge is recorded above.

### Windows installation passed; native runtime failed

[Latest Windows release run 37102794622](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102794622)
built a new installer from the corrected source. Standard-user preflight, native
notices, all **eight** extraction-boundary tests, installer build and silent
installation **passed**. The actual installed application then exited with code
**101**, so native runtime verification **failed** and publication was **skipped**.
This confirms that the current source was built and installed; it does not turn
the prior diagnostic failures into native passes. No public EXE/release had been published at that stage.

The earlier release/harness comparisons remain relevant diagnostic history:

[Windows release run 37101691271](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691271)
tested PR merge `a2b7697e7913ff7420a47a48defd54103932892e` (head
`145942bfd20675418741078d5e947629b92221cc` into
`6644d304f7a44124658672c82cd18a3d5c0dd947`). Its results are:

| Release gate | Verified result |
| --- | --- |
| Isolated standard-user preflight and cleanup | Passed |
| Native distribution notice generation | Passed |
| Release extraction boundary tests | Eight passed |
| Windows installer compilation/packaging | Passed |
| Silent installation into the disposable runner directory | Passed; installed executable and notices present |
| Actual installed WebView2 application smoke | Failed |
| Named release preparation and publication | Skipped; no usable public-release claim |

This establishes an actual CI installation, beyond the older packaging-only
evidence. It does not establish a working native PDF workflow or a successful
interactive installation on end-user machines. CI diagnostic installer artifacts
are not verified public releases.

[Fast diagnostic run 37101691273](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37101691273)
used the same harness merge and provenance-checked unchanged installer source
`3d122090cca651e007b0759be72a43be41ac1666`. Installation again passed; the runtime
diagnostic failed. Under target-account impersonation, creation of a newly
randomized `Local\` mutex returned access-denied error **5**. The observed
launcher/token/child session values were all **2**, the fresh test profile's full
ACL access and child standard-user token were verified, and exact job, account,
profile and private-desktop cleanup passed. These observations narrow the failure;
they do not establish its final cause or a working runtime. Genuine token evidence
also confirms `TokenHasRestrictions` returned length **1**, value **0**.

The final `CreateProcessWithLogonW` comparison,
[run 37102433709](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709),
also **failed** with the same WebView2 `ProcessSingleton` startup failure before
CDP became available. Folio exited with code **101**. Its
[diagnostic artifact 11266003295](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37102433709/artifacts/11266003295)
was downloaded and independently hash-checked:
`d4d36f47f1b8258a6ea62a56b09d3176813121f0ad6720b207bc2e60b0a1fd6a` (archive SHA-256).

The actual suspended child passed every standard-user token gate: correct account,
non-elevated Medium integrity, Users enabled, no Administrators SID or token
restrictions, and session **2**. The target account owned `EBWebView` and had an
inherited FullControl rule. The random `Local\` mutex probe under helper
impersonation still returned **5**; that helper probe does not establish the
child's exact namespace behavior. All five cleanup results were true—owned job
empty, profile unloaded, profile deleted, account removed and private desktop
closed—with no cleanup errors.

Launcher retries in this hosted environment have ended. **Native runtime
verification is blocked here** and next requires a normal interactive Windows
session or another suitable test environment. These failures do not prove Folio
fails on ordinary Windows installations. The public Windows release remains
unpublished. Native PDF workflows and release gates still need actual passing
evidence. The latest release run above rebuilt and installed the corrected source
but still failed runtime startup. Corrected-source macOS browser CI has since
passed; that browser result is separate from this native blocker.

## Historical local evidence: upgrade and v2 delivery

Earlier local audit/timing evidence used production build 2e61d5c66548dcdc at http://127.0.0.1:4173 on Windows. The final library regression rerun and successful CI/delivery revisions are recorded separately below.

| Check | Verified result |
| --- | --- |
| Strict TypeScript and production client/Worker build | Passed |
| Node unit/fixture tests | 55 passed, zero failures/skips; 5.85 seconds |
| Windows Edge reader/offline regressions | 24 passed; 35.4 seconds |
| Windows Edge local library | 14 shell + 9 IndexedDB cases passed; final rerun 27.5 seconds after ArrayBuffer compatibility repair, including legacy Blob reads |
| Windows Edge OCR | 4 passed; 9.9 seconds, including offline-after-first-use |
| Windows Edge page organization | 8 passed; 18.3 seconds |
| Windows Edge signing UI | 3 passed; 5.9 seconds |
| Windows Edge checkpoint/core tests | 7 passed; 13.6 seconds |
| Windows Edge signing core | 9 passed; independent Node crypto checks |
| Accessibility | 9 production UI states: zero axe violations; four PDF-content contrast checks incomplete |
| Runtime npm audit | Zero known advisories returned for 44 runtime/optional dependencies; compiled WASM is not covered |

The v2-source complete E2E suite contains 63 tests, including the hosted-redirect regression. The separate core/signing suites contain 16. Suite durations are execution times, not application performance. Windows Edge production audit version154.0.4258.53; Chrome measurement version153.0.8010.54.

## Verified workflows and safety

Reader checks exercise actual PDFs, selection/search/outlines, annotations/forms, original-byte preservation and fresh reopen, tabs/widget isolation, bad input/password/permissions, print-copy handoff and six responsive viewport classes. They check uncaught errors and external document requests.

Local library checks exercise explicit consent/refusal, reload recovery, exact immutable original download, clean/dirty checkpoint transitions, continuous-scrolling debounce, quota rollback, damaged-copy detection, stale-tab conflicts, namespace separation, encrypted-source/password preservation, offline/account-service outages and canceled signout. Account API tests used220 concurrent registration attempts: exactly200 accounts; repeated registrations reused the same account. This is not a200-concurrent-user load test.

Page operations verify every retained page's text, geometry and bounded rendered pixels before download; unsupported document structures are rejected. Signing tests verify real downloaded CMS/ByteRange with independent Node cryptography, preserve original bytes and form appearances, reopen signed output, reject wrong passwords/unsupported certificates and cancel workers. Certificate trust, revocation and trusted timestamps remain unverified.

OCR recognizes a real image-only fixture, exports text and cancels during model initialization. The offline test confirms no OCR preload, selected worker/core/model cached after use, complete offline reload/reselection, matching output and no PDF/blob CacheStorage entries. Device-library PDFs are separately stored in IndexedDB only with consent.

Fidelity checks embed static Latin/Greek/Cyrillic/CJK/Arabic fonts, verify meaningful Unicode/rendering, preserve unrelated transparency pages through mutation and compare output using independent Poppler. This is a synthetic corpus, not broad compatibility certification.

## Responsive, accessibility and physical boundaries

Desktop1600x1000, laptop1280x800, tablet1024x768/768x1024 and phone390x844/844x390 reader workflows passed. A discovered768px toolbar clipping defect was repaired and the affected regression passed. Phone organization/library dialogs were inspected.

The audit verifies accessible form-name fallbacks, valid tab semantics, contrast repairs, visible keyboard focus and focus restoration. [Audit details](accessibility-audit.md) record incomplete PDF contrast checks. Physical touch/stylus, screen-reader reading order, VoiceOver/TalkBack/NVDA and full WCAG conformance remain unverified.

Printing verification means a local PDF reaches browser viewer/download handling. No physical printer output, native driver fidelity or mobile print sheet was verified. A download event is not a filesystem durability guarantee.

## Performance

[Raw measurements](benchmark-2026-10-03.json): one run per configuration, Windows Chrome153, localhost, a synthetic200-page342,975-byte PDF. Phone is390x844 emulation with4x CPU throttling, not a physical device.

| Measurement | Desktop | Phone emulation |
| --- | ---: | ---: |
| Shell ready | 122ms | 287ms |
| First page, controller timing | 230ms | 493ms |
| Open workflow, including picker/test overhead | 417ms | 1080ms |
| Search to final-page match, including debounce | 449ms | 572ms |
| Live canvases at sample | 4 | 5 |
| Canvas pixels at sample | 7,222,996 | 791,000 |
| Reported JS heap at sample | 10,663,756B | 11,617,220B |

Heap samples exclude total browser/native/worker/canvas memory and are not peaks. Single-run values are not benchmark distributions. The earlier measured build had approximately 75.8 KB initial JS (24.6 KB gzip); v2 reports 75.88 KB (24.71 KB gzip). Mandatory offline assets were 8.06 MiB in the measured build. OCR loads its worker, one selected core and English model on request. Large-byte scans, battery and physical low-memory devices remain unmeasured.

## Historical remote CI and native packaging: v2 application source

GitHub repository: [KingGogusV/Project-PDF-reader-](https://github.com/KingGogusV/Project-PDF-reader-). At v2 delivery, the upgrade branch was `feature/hosted-local-library`; [PR 1](https://github.com/KingGogusV/Project-PDF-reader-/pull/1).

[V2-source Reader run 37091186897](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186897) **succeeded in all jobs** on application commit `710ff978c4f59b907bce108921ade34b6d2b5326`: 55 unit/fixture checks with zero skips, typecheck/build, 63 E2E cases on Linux Chromium (2.1 minutes), 63 E2E cases on macOS WebKit (4.3 minutes, no flaky marker), seven controller checkpoints (11.5 seconds) and nine signing-core cases (11.7 seconds). These are suite durations. Playwright WebKit is not branded Safari or a physical Apple-device test. This historical pass does not supersede the later GC failure or verify its correction.

[V2-source native run 37091186893](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893) **succeeded on Windows and macOS**, producing unsigned NSIS and app/DMG packages with a retained Cargo lockfile. This run verified compilation/packaging, not installation, native runtime, signing or notarization. Later Windows installation evidence is recorded in the current addendum above.

| Verified artifact | ZIP size | SHA-256 |
| --- | ---: | --- |
| [Windows NSIS package](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11262104539) | 13,946,200 bytes | `2a0e6bdc1b459d887e3e77886dba1600c311751ca83e7d2b57e585eea531fc6f` |
| [macOS app/DMG packages](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37091186893/artifacts/11261664576) | 29,792,212 bytes | `e47283997b450e6c32cf072f6911557dfa41fca53f00a5f63025f77d78ccbf38` |

These CI downloads expire **2026-10-17** and may require GitHub access. They are development artifacts, not permanent signed releases. Earlier runs 37088665148/37088665153 exposed signing-harness navigation, WebKit Blob storage and Windows CLI argument-forwarding failures; the listed v2 runs verify those corrections.

## Hosting and identity

Current deployment **v3** `appgdep_6ac0a0deb3108191a9fbce3e650d4019` reached terminal
success at **2026-10-03 06:30:01.366914 UTC**. URL:
[Folio](https://folio-local-pdf.gogoi-ronnie.chatgpt.site). App manifest:
`4336354ebff242c2`.

Published Site source `e3437ffb0d6e45b469f167845c009b2ee24f28e5` and GitHub
implementation `85cc5de6378e64372549fb298d383374c74a488a` have identical verified
tree `8fcd7d07f26969320f361319b9d317930bd136f6`. GitHub remains authoritative;
the separate Site ancestry is preserved. Later documentation-only commits must
not be described as independently deployed or tested application revisions.

At **06:30:37.083 UTC**, the live v3 smoke report passed:

- Anonymous account GET returned **200**, null identity/account, limit **200** and registered **0**.
- Forged identity headers were refused with **401**; sign-in redirected with **302** to `auth.openai.com`.
- A local form was explicitly stored, edited, reloaded and recovered with its value intact.
- Chromium network-offline reload and reopening the device-local PDF passed.
- The 390-pixel phone viewport had no horizontal overflow; its screenshot was inspected and usable.
- Observed document workflows made no POST/document-upload requests and produced no page errors. The separate forged-header API probe was deliberately sent and refused.

Against this deployed v3 URL, Windows Playwright WebKit also passed the real
forced-GC Ink export/reopen regression: **one passed in 6.1 seconds**. An initial
test invocation could not locate the installed browser; setting
`PLAYWRIGHT_BROWSERS_PATH` to the existing `.cache/playwright` installation fixed
the test setup. That invocation did not exercise or demonstrate an application
failure. It remains a Windows WebKit test, not branded Safari or a physical Apple
device test.

Actual managed sign-in, account registration/sign-out sessions and live
capacity/load remain **unverified**. A provider redirect is not a completed
authenticated session. The hosted update contains the reader correction; it does
not publish or validate the Windows installer.

### Historical deployment v2

Deployment **v2** `appgdep_6ac06d8fe58c819181427cd4cea78796` reached terminal success at **2026-10-03 02:51:08 UTC** at the same URL. Its app manifest was `b2837e77c6ac14a7`.

Published Site source `cae5f95b0255f6278c485c78da834adf606e6a60` and GitHub implementation `710ff978c4f59b907bce108921ade34b6d2b5326` have identical verified tree `09642b4ac086bf603510c5fc75fcf1aa14862650`. Their ancestry differs. GitHub remains authoritative. Preserve Site history on `site-publication`; align `feature/hosted-local-library` with the actual fetched GitHub HEAD by branch switching without resets/history rewriting. Future publishing must merge/reconcile Site and GitHub feature/main ancestry without force-pushing. Final documentation commits are separate from this delivered implementation snapshot.

At **02:51:18 UTC**, live v2 checks passed:

- Root/app and account dialog, including its sign-in button, loaded.
- Anonymous `GET /api/account` returned 200, null identity/account, limit 200 and registered 0.
- A POST with forged identity headers returned 401; managed sign-in redirected with 302 to `auth.openai.com`.
- A real local form was opened, explicitly stored, edited, reloaded online and recovered with its value intact.
- A 390-pixel phone viewport had no body overflow.
- With Chromium's actual browser-offline mode enabled, the hosted app reloaded and reopened the device-local form with its edited value preserved.
- No PDF uploads or application page exceptions were observed.

The live D1 accounts table was confirmed. Actual managed sign-in, account registration/sign-out sessions and live capacity/load were **not** exercised. A redirect to the provider is not a completed authenticated session.

### Offline correction and source-specific CI

Deployment v1 `appgdep_6ac06a440c048191bac16353afd60fa4` succeeded at 02:37:09 UTC, using Site `f7734929de58e05f280b536fbcd20b875a423221` and identical-tree GitHub `6033dbf3546b0eef776507bc50b14ee354ca6273`. Its online checks passed, but Chromium offline reload returned `net::ERR_FAILED`: the host canonicalized `/index.html` to the root and the cached response retained redirect state.

The worker now normalizes cached navigation responses. The added regression failed against the old worker, then the two direct/canonical offline cases passed on Edge and WebKit before v2 deployment. The live Chromium pass above verifies the actual hosted repair. WebKit's automated test uses an unavailable origin because its offline-emulation limitation differs; it is not a physical Safari test.

V2-source Reader run 37091186897 and native run 37091186893 both succeeded in all jobs, as detailed above. Those results remain tied to the historical v2 identity; the current corrected deployment is v3.

Historical Reader run 37089902258 passed 62 cases before the added redirect regression; the primary artifact table refers exclusively to the v2-source packages. CI evidence attaches to the tested application commit, not a later documentation-only HEAD. Engineering-record updates do not require republishing unchanged application inputs and must not be described as a separately tested build.

### Hosting header boundary

Static responses bypass the worker's static-response header code. Restrictive document metadata CSP and `referrer=no-referrer` metadata were confirmed in v2; the v3 smoke confirms its restrictive metadata CSP remains present. HTTP CSP/frame-ancestors/nosniff and Referrer-Policy header enforcement remain unestablished; the unsuccessful static-header experiment was reverted. Supported host-level header configuration remains a release task. CSP was not weakened to allow host-injected inline code.

## Security review and remaining gates

OCR's native inventory includes older zlib/libwebp affected by known advisories. Independent review traced Folio's only recognition input to a fresh browser-encoded PNG; production worker interception confirmed PNG IHDR/IDAT/IEND only, fixed same-origin model and bounded actions. The reviewed gzip-header/WebP paths were not found reachable through this interface. This supports constrained experimental OCR, not a patched-binary or production-security claim. A reproducible patched native rebuild and wider advisory review remain stable-release gates; see [OCR research](ocr-research.md).

Physical iOS/Android, Safari itself, native PDF runtime workflows, macOS installation, signing/notarization, physical printing, comprehensive assistive technology, high-byte stress, XFA, broad pre-existing annotation preservation, certificate trust/revocation/timestamping and arbitrary content editing/redaction remain unverified or unimplemented. Windows silent installation passed on the disposable runner; that does not cover interactive installation or normal end-user devices. Browser eviction or a crash before a validated checkpoint can still lose recent work.

## Corrected native close and packaging identity - 2026-10-03

Application PR head `c720587726f486bbf431f1067ca353f2e2fd85f6` / merge source `9de673b3acf0a3f1f91989648246473f91e8875b` built on Windows and macOS in run [37120365003](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120365003). Reader run [37120364985](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120364985) passed: 59 unit cases with zero skips, 66 Linux Chromium E2E, seven checkpoint cases and nine signing cases. macOS WebKit had 65 first-attempt passes and one OCR cancellation/retry page crash that passed its automatic retry. The crash is retained as an unresolved experimental-OCR issue, not described as fixed. Three focused local Windows WebKit reruns passed (12.6 seconds).

Windows release run [37120364964](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37120364964) passed all 14 actual native checks, including OS-close cancel and confirmed clean exit, then failed only the raw build/installed hash comparison. The downloaded diagnostic installer (SHA-256 `12fd743a3511bf369fd2991d0ed99bc4457b5cdfd155c2de51eb6d336ed425d0`) was installed into the same task-owned temporary directory. All 14 normal-user WebView2 154 checks and 533 installed notice hashes passed. See [sanitized native evidence](native-windows-close-2026-10-03.json).

The installed EXE SHA-256 is `998a0595d8a8e8215e03e9c3307fd248c70f36becbbb14c553dc9b342265a355`. Reversing only the reviewed marker at byte 18469506 reproduces the independently logged build hash `afec79d8a54f795a5d817c41a3aa6c17cdcdb34cfcdc766384ee8a734314e982`. The new comparator checks all bytes and has four passing tests for identity, tampering, ambiguous markers, size and version rejection. Its revised CI prepare/publication result was pending at that point; final main-source validation and publication subsequently passed (see the current record above).

The live website was rechecked at 11:40:57 UTC: anonymous account API limit 200, forged identity refusal, managed sign-in redirect, guest local form recovery, phone layout and actual Chromium-offline reopen passed. No uploads/page exceptions were observed. Full signed-in account sessions remain unverified.

## Accessibility pass — local verification, 2026-10-03

2026-10-03 UTC, Linux, Google Chrome for Testing **153.0.8010.12**, Playwright 1.63.0. Frozen dependency installation, type checking, 63 unit/fixture tests (zero skips), production client/account-worker build, **79 browser workflows**, seven core/checkpoint cases, nine signing cases and eight release-extraction cases passed. After the final footer layout adjustment, all **19 affected accessibility/responsive cases** passed again. No retries or skips were needed for the final local browser suite.

All **15 axe states reported zero violations**. `color-contrast` remained incomplete in the welcome footer, PDF/text/canvas states, and some clipped/overlapping content reported in OCR, signing and phone-actions dialogs. These incomplete checks were retained, not suppressed or relabeled as passes. Application Properties labels improved from 3.60:1 to 6.36:1. Screenshot review covered desktop 1600 x 1000, laptop 1280 x 800, tablet 1024 x 768 and 768 x 1024, phone 390 x 844 and 844 x 390, 320 x 256 reflow, doubled text and forced colors.

The local production shell JavaScript is **79.62 kB / 25.90 kB gzip**, compared with the inspected baseline 76.69 kB / 25.02 kB gzip. This is a build-size measurement, not a device-speed benchmark. No new runtime dependency was added. GitHub/macOS/native results and publication must be checked separately against their actual source revisions.

The managed agent preview was unreachable from this environment. Actual production browser verification instead used the repository's existing Playwright web-server harness. This does not indicate a failure of the hosted site. Windows 0.1.1 release preparation preserves the 0.1.0 public release; publication and new native checks are not claimed here until their runs complete.

Final screenshot review also caught phone action buttons compressed into columns of broken words. Actions now wrap into readable rows; a minimum readable-width regression and the complete 13-case accessibility gate passed after that correction. OCR/signing dialog screenshots showed readable foreground content despite the automated overlap/incomplete reports; those reports remain available for assistive-technology review.

### Cross-platform accessibility gate

PR head `608bf0943627a3d8689ef63ed248f5ae57032eca` passed Reader CI [37140750050](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37140750050): 79 workflows on Linux Chromium and 79 on macOS WebKit, with no retries/skips in the downloaded macOS report. All 15 macOS axe states had zero violations. The artifact ZIP SHA-256 was verified before inspecting its 320-pixel, doubled-text phone and phone-actions screenshots. The native Windows/macOS package build [37140749981](https://github.com/KingGogusV/Project-PDF-reader-/actions/runs/37140749981) also passed.

Windows release gate 37140749969 built and installed the app, then failed before reader tests because `Win32_Process.ExecutablePath` was empty during runtime metadata collection. Its retained launch report confirms owned-job and policy cleanup. The harness now waits for that metadata within its existing startup bound; it still requires the owned runtime path/version, isolated profile, debugging port and cleanup checks. No release was published by that failed run. Whether the empty field was a transient startup race remains an inference until the rerun.

### Published browser accessibility update

Website version **4** succeeded at **2026-10-03T17:43:53.819048Z** at the existing public URL. Deployment `appgdep_6ac13ecd06308191bb865188a4e9c0d6` uses Site source `63dd341f02c4aa1de98ec82dc657a3c751507be7`, whose tree exactly matches GitHub `86f25470c53cd56e600d51d6c21b7a764e9438f0`. No account, database schema, document engine or PDF-upload behavior changed. The built shell is `index-DIAAStxT.js`; CSS is `index-DwfgPVrD.css`; service-worker manifest is `18be62c44b734fa5`. Publication status was verified through the hosting service; browser workflows ran against production build output in the test harness, not an authenticated production user session.

[Machine-readable evidence](accessibility-verification-2026-10-03.json) retains both engines’ 15-state summaries, including incomplete checks. The final local 79-case run and downloaded macOS 79-case report both had zero failures, retries or skips. Local Linux WebKit setup remained blocked by host dependency validation; actual macOS WebKit CI supplied the second-engine evidence.
