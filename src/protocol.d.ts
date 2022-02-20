type binary = string;
export module Protocol {
  /**
   * This domain is deprecated - use Runtime or Log instead.
   */
  export module Console {
    /**
     * Console message.
     */
    export interface ConsoleMessage {
      /**
       * Message source.
       */
      source: "xml"|"javascript"|"network"|"console-api"|"storage"|"appcache"|"rendering"|"security"|"other"|"deprecation"|"worker";
      /**
       * Message severity.
       */
      level: "log"|"warning"|"error"|"debug"|"info";
      /**
       * Message text.
       */
      text: string;
      /**
       * URL of the message origin.
       */
      url?: string;
      /**
       * Line number in the resource that generated this message (1-based).
       */
      line?: number;
      /**
       * Column number in the resource that generated this message (1-based).
       */
      column?: number;
    }
    
    /**
     * Issued when new console message is added.
     */
    export type messageAddedPayload = {
      /**
       * Console message that has been added.
       */
      message: ConsoleMessage;
    }
    
    /**
     * Does nothing.
     */
    export type clearMessagesParameters = {
    }
    export type clearMessagesReturnValue = {
    }
    /**
     * Disables console domain, prevents further console messages from being reported to the client.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Enables console domain, sends the messages collected so far to the client by means of the
`messageAdded` notification.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
  }
  
  /**
   * Debugger domain exposes JavaScript debugging capabilities. It allows setting and removing
breakpoints, stepping through execution, exploring stack traces, etc.
   */
  export module Debugger {
    /**
     * Breakpoint identifier.
     */
    export type BreakpointId = string;
    /**
     * Call frame identifier.
     */
    export type CallFrameId = string;
    /**
     * Location in the source code.
     */
    export interface Location {
      /**
       * Script identifier as reported in the `Debugger.scriptParsed`.
       */
      scriptId: Runtime.ScriptId;
      /**
       * Line number in the script (0-based).
       */
      lineNumber: number;
      /**
       * Column number in the script (0-based).
       */
      columnNumber?: number;
    }
    /**
     * Location in the source code.
     */
    export interface ScriptPosition {
      lineNumber: number;
      columnNumber: number;
    }
    /**
     * Location range within one script.
     */
    export interface LocationRange {
      scriptId: Runtime.ScriptId;
      start: ScriptPosition;
      end: ScriptPosition;
    }
    /**
     * JavaScript call frame. Array of call frames form the call stack.
     */
    export interface CallFrame {
      /**
       * Call frame identifier. This identifier is only valid while the virtual machine is paused.
       */
      callFrameId: CallFrameId;
      /**
       * Name of the JavaScript function called on this call frame.
       */
      functionName: string;
      /**
       * Location in the source code.
       */
      functionLocation?: Location;
      /**
       * Location in the source code.
       */
      location: Location;
      /**
       * JavaScript script name or url.
       */
      url: string;
      /**
       * Scope chain for this call frame.
       */
      scopeChain: Scope[];
      /**
       * `this` object for this call frame.
       */
      this: Runtime.RemoteObject;
      /**
       * The value being returned, if the function is at return point.
       */
      returnValue?: Runtime.RemoteObject;
    }
    /**
     * Scope description.
     */
    export interface Scope {
      /**
       * Scope type.
       */
      type: "global"|"local"|"with"|"closure"|"catch"|"block"|"script"|"eval"|"module"|"wasm-expression-stack";
      /**
       * Object representing the scope. For `global` and `with` scopes it represents the actual
object; for the rest of the scopes, it is artificial transient object enumerating scope
variables as its properties.
       */
      object: Runtime.RemoteObject;
      name?: string;
      /**
       * Location in the source code where scope starts
       */
      startLocation?: Location;
      /**
       * Location in the source code where scope ends
       */
      endLocation?: Location;
    }
    /**
     * Search match for resource.
     */
    export interface SearchMatch {
      /**
       * Line number in resource content.
       */
      lineNumber: number;
      /**
       * Line with match content.
       */
      lineContent: string;
    }
    export interface BreakLocation {
      /**
       * Script identifier as reported in the `Debugger.scriptParsed`.
       */
      scriptId: Runtime.ScriptId;
      /**
       * Line number in the script (0-based).
       */
      lineNumber: number;
      /**
       * Column number in the script (0-based).
       */
      columnNumber?: number;
      type?: "debuggerStatement"|"call"|"return";
    }
    /**
     * Enum of possible script languages.
     */
    export type ScriptLanguage = "JavaScript"|"WebAssembly";
    /**
     * Debug symbols available for a wasm script.
     */
    export interface DebugSymbols {
      /**
       * Type of the debug symbols.
       */
      type: "None"|"SourceMap"|"EmbeddedDWARF"|"ExternalDWARF";
      /**
       * URL of the external symbol source.
       */
      externalURL?: string;
    }
    
    /**
     * Fired when breakpoint is resolved to an actual script and location.
     */
    export type breakpointResolvedPayload = {
      /**
       * Breakpoint unique identifier.
       */
      breakpointId: BreakpointId;
      /**
       * Actual breakpoint location.
       */
      location: Location;
    }
    /**
     * Fired when the virtual machine stopped on breakpoint or exception or any other stop criteria.
     */
    export type pausedPayload = {
      /**
       * Call stack the virtual machine stopped on.
       */
      callFrames: CallFrame[];
      /**
       * Pause reason.
       */
      reason: "ambiguous"|"assert"|"CSPViolation"|"debugCommand"|"DOM"|"EventListener"|"exception"|"instrumentation"|"OOM"|"other"|"promiseRejection"|"XHR";
      /**
       * Object containing break-specific auxiliary properties.
       */
      data?: { [key: string]: string };
      /**
       * Hit breakpoints IDs
       */
      hitBreakpoints?: string[];
      /**
       * Async stack trace, if any.
       */
      asyncStackTrace?: Runtime.StackTrace;
      /**
       * Async stack trace, if any.
       */
      asyncStackTraceId?: Runtime.StackTraceId;
      /**
       * Never present, will be removed.
       */
      asyncCallStackTraceId?: Runtime.StackTraceId;
    }
    /**
     * Fired when the virtual machine resumed execution.
     */
    export type resumedPayload = void;
    /**
     * Fired when virtual machine fails to parse the script.
     */
    export type scriptFailedToParsePayload = {
      /**
       * Identifier of the script parsed.
       */
      scriptId: Runtime.ScriptId;
      /**
       * URL or name of the script parsed (if any).
       */
      url: string;
      /**
       * Line offset of the script within the resource with given URL (for script tags).
       */
      startLine: number;
      /**
       * Column offset of the script within the resource with given URL.
       */
      startColumn: number;
      /**
       * Last line of the script.
       */
      endLine: number;
      /**
       * Length of the last line of the script.
       */
      endColumn: number;
      /**
       * Specifies script creation context.
       */
      executionContextId: Runtime.ExecutionContextId;
      /**
       * Content hash of the script.
       */
      hash: string;
      /**
       * Embedder-specific auxiliary data.
       */
      executionContextAuxData?: { [key: string]: string };
      /**
       * URL of source map associated with script (if any).
       */
      sourceMapURL?: string;
      /**
       * True, if this script has sourceURL.
       */
      hasSourceURL?: boolean;
      /**
       * True, if this script is ES6 module.
       */
      isModule?: boolean;
      /**
       * This script length.
       */
      length?: number;
      /**
       * JavaScript top stack frame of where the script parsed event was triggered if available.
       */
      stackTrace?: Runtime.StackTrace;
      /**
       * If the scriptLanguage is WebAssembly, the code section offset in the module.
       */
      codeOffset?: number;
      /**
       * The language of the script.
       */
      scriptLanguage?: Debugger.ScriptLanguage;
      /**
       * The name the embedder supplied for this script.
       */
      embedderName?: string;
    }
    /**
     * Fired when virtual machine parses script. This event is also fired for all known and uncollected
scripts upon enabling debugger.
     */
    export type scriptParsedPayload = {
      /**
       * Identifier of the script parsed.
       */
      scriptId: Runtime.ScriptId;
      /**
       * URL or name of the script parsed (if any).
       */
      url: string;
      /**
       * Line offset of the script within the resource with given URL (for script tags).
       */
      startLine: number;
      /**
       * Column offset of the script within the resource with given URL.
       */
      startColumn: number;
      /**
       * Last line of the script.
       */
      endLine: number;
      /**
       * Length of the last line of the script.
       */
      endColumn: number;
      /**
       * Specifies script creation context.
       */
      executionContextId: Runtime.ExecutionContextId;
      /**
       * Content hash of the script.
       */
      hash: string;
      /**
       * Embedder-specific auxiliary data.
       */
      executionContextAuxData?: { [key: string]: string };
      /**
       * True, if this script is generated as a result of the live edit operation.
       */
      isLiveEdit?: boolean;
      /**
       * URL of source map associated with script (if any).
       */
      sourceMapURL?: string;
      /**
       * True, if this script has sourceURL.
       */
      hasSourceURL?: boolean;
      /**
       * True, if this script is ES6 module.
       */
      isModule?: boolean;
      /**
       * This script length.
       */
      length?: number;
      /**
       * JavaScript top stack frame of where the script parsed event was triggered if available.
       */
      stackTrace?: Runtime.StackTrace;
      /**
       * If the scriptLanguage is WebAssembly, the code section offset in the module.
       */
      codeOffset?: number;
      /**
       * The language of the script.
       */
      scriptLanguage?: Debugger.ScriptLanguage;
      /**
       * If the scriptLanguage is WebASsembly, the source of debug symbols for the module.
       */
      debugSymbols?: Debugger.DebugSymbols;
      /**
       * The name the embedder supplied for this script.
       */
      embedderName?: string;
    }
    
    /**
     * Continues execution until specific location is reached.
     */
    export type continueToLocationParameters = {
      /**
       * Location to continue to.
       */
      location: Location;
      targetCallFrames?: "any"|"current";
    }
    export type continueToLocationReturnValue = {
    }
    /**
     * Disables debugger for given page.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Enables debugger for the given page. Clients should not assume that the debugging has been
enabled until the result for this command is received.
     */
    export type enableParameters = {
      /**
       * The maximum size in bytes of collected scripts (not referenced by other heap objects)
the debugger can hold. Puts no limit if parameter is omitted.
       */
      maxScriptsCacheSize?: number;
    }
    export type enableReturnValue = {
      /**
       * Unique identifier of the debugger.
       */
      debuggerId: Runtime.UniqueDebuggerId;
    }
    /**
     * Evaluates expression on a given call frame.
     */
    export type evaluateOnCallFrameParameters = {
      /**
       * Call frame identifier to evaluate on.
       */
      callFrameId: CallFrameId;
      /**
       * Expression to evaluate.
       */
      expression: string;
      /**
       * String object group name to put result into (allows rapid releasing resulting object handles
using `releaseObjectGroup`).
       */
      objectGroup?: string;
      /**
       * Specifies whether command line API should be available to the evaluated expression, defaults
to false.
       */
      includeCommandLineAPI?: boolean;
      /**
       * In silent mode exceptions thrown during evaluation are not reported and do not pause
execution. Overrides `setPauseOnException` state.
       */
      silent?: boolean;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether to throw an exception if side effect cannot be ruled out during evaluation.
       */
      throwOnSideEffect?: boolean;
      /**
       * Terminate execution after timing out (number of milliseconds).
       */
      timeout?: Runtime.TimeDelta;
    }
    export type evaluateOnCallFrameReturnValue = {
      /**
       * Object wrapper for the evaluation result.
       */
      result: Runtime.RemoteObject;
      /**
       * Exception details.
       */
      exceptionDetails?: Runtime.ExceptionDetails;
    }
    /**
     * Returns possible locations for breakpoint. scriptId in start and end range locations should be
the same.
     */
    export type getPossibleBreakpointsParameters = {
      /**
       * Start of range to search possible breakpoint locations in.
       */
      start: Location;
      /**
       * End of range to search possible breakpoint locations in (excluding). When not specified, end
of scripts is used as end of range.
       */
      end?: Location;
      /**
       * Only consider locations which are in the same (non-nested) function as start.
       */
      restrictToFunction?: boolean;
    }
    export type getPossibleBreakpointsReturnValue = {
      /**
       * List of the possible breakpoint locations.
       */
      locations: BreakLocation[];
    }
    /**
     * Returns source for the script with given id.
     */
    export type getScriptSourceParameters = {
      /**
       * Id of the script to get source for.
       */
      scriptId: Runtime.ScriptId;
    }
    export type getScriptSourceReturnValue = {
      /**
       * Script source (empty in case of Wasm bytecode).
       */
      scriptSource: string;
      /**
       * Wasm bytecode.
       */
      bytecode?: binary;
    }
    /**
     * This command is deprecated. Use getScriptSource instead.
     */
    export type getWasmBytecodeParameters = {
      /**
       * Id of the Wasm script to get source for.
       */
      scriptId: Runtime.ScriptId;
    }
    export type getWasmBytecodeReturnValue = {
      /**
       * Script source.
       */
      bytecode: binary;
    }
    /**
     * Returns stack trace with given `stackTraceId`.
     */
    export type getStackTraceParameters = {
      stackTraceId: Runtime.StackTraceId;
    }
    export type getStackTraceReturnValue = {
      stackTrace: Runtime.StackTrace;
    }
    /**
     * Stops on the next JavaScript statement.
     */
    export type pauseParameters = {
    }
    export type pauseReturnValue = {
    }
    export type pauseOnAsyncCallParameters = {
      /**
       * Debugger will pause when async call with given stack trace is started.
       */
      parentStackTraceId: Runtime.StackTraceId;
    }
    export type pauseOnAsyncCallReturnValue = {
    }
    /**
     * Removes JavaScript breakpoint.
     */
    export type removeBreakpointParameters = {
      breakpointId: BreakpointId;
    }
    export type removeBreakpointReturnValue = {
    }
    /**
     * Restarts particular call frame from the beginning.
     */
    export type restartFrameParameters = {
      /**
       * Call frame identifier to evaluate on.
       */
      callFrameId: CallFrameId;
    }
    export type restartFrameReturnValue = {
      /**
       * New stack trace.
       */
      callFrames: CallFrame[];
      /**
       * Async stack trace, if any.
       */
      asyncStackTrace?: Runtime.StackTrace;
      /**
       * Async stack trace, if any.
       */
      asyncStackTraceId?: Runtime.StackTraceId;
    }
    /**
     * Resumes JavaScript execution.
     */
    export type resumeParameters = {
      /**
       * Set to true to terminate execution upon resuming execution. In contrast
to Runtime.terminateExecution, this will allows to execute further
JavaScript (i.e. via evaluation) until execution of the paused code
is actually resumed, at which point termination is triggered.
If execution is currently not paused, this parameter has no effect.
       */
      terminateOnResume?: boolean;
    }
    export type resumeReturnValue = {
    }
    /**
     * Searches for given string in script content.
     */
    export type searchInContentParameters = {
      /**
       * Id of the script to search in.
       */
      scriptId: Runtime.ScriptId;
      /**
       * String to search for.
       */
      query: string;
      /**
       * If true, search is case sensitive.
       */
      caseSensitive?: boolean;
      /**
       * If true, treats string parameter as regex.
       */
      isRegex?: boolean;
    }
    export type searchInContentReturnValue = {
      /**
       * List of search matches.
       */
      result: SearchMatch[];
    }
    /**
     * Enables or disables async call stacks tracking.
     */
    export type setAsyncCallStackDepthParameters = {
      /**
       * Maximum depth of async call stacks. Setting to `0` will effectively disable collecting async
call stacks (default).
       */
      maxDepth: number;
    }
    export type setAsyncCallStackDepthReturnValue = {
    }
    /**
     * Replace previous blackbox patterns with passed ones. Forces backend to skip stepping/pausing in
scripts with url matching one of the patterns. VM will try to leave blackboxed script by
performing 'step in' several times, finally resorting to 'step out' if unsuccessful.
     */
    export type setBlackboxPatternsParameters = {
      /**
       * Array of regexps that will be used to check script url for blackbox state.
       */
      patterns: string[];
    }
    export type setBlackboxPatternsReturnValue = {
    }
    /**
     * Makes backend skip steps in the script in blackboxed ranges. VM will try leave blacklisted
scripts by performing 'step in' several times, finally resorting to 'step out' if unsuccessful.
Positions array contains positions where blackbox state is changed. First interval isn't
blackboxed. Array should be sorted.
     */
    export type setBlackboxedRangesParameters = {
      /**
       * Id of the script.
       */
      scriptId: Runtime.ScriptId;
      positions: ScriptPosition[];
    }
    export type setBlackboxedRangesReturnValue = {
    }
    /**
     * Sets JavaScript breakpoint at a given location.
     */
    export type setBreakpointParameters = {
      /**
       * Location to set breakpoint in.
       */
      location: Location;
      /**
       * Expression to use as a breakpoint condition. When specified, debugger will only stop on the
breakpoint if this expression evaluates to true.
       */
      condition?: string;
    }
    export type setBreakpointReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
      /**
       * Location this breakpoint resolved into.
       */
      actualLocation: Location;
    }
    /**
     * Sets instrumentation breakpoint.
     */
    export type setInstrumentationBreakpointParameters = {
      /**
       * Instrumentation name.
       */
      instrumentation: "beforeScriptExecution"|"beforeScriptWithSourceMapExecution";
    }
    export type setInstrumentationBreakpointReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
    }
    /**
     * Sets JavaScript breakpoint at given location specified either by URL or URL regex. Once this
command is issued, all existing parsed scripts will have breakpoints resolved and returned in
`locations` property. Further matching script parsing will result in subsequent
`breakpointResolved` events issued. This logical breakpoint will survive page reloads.
     */
    export type setBreakpointByUrlParameters = {
      /**
       * Line number to set breakpoint at.
       */
      lineNumber: number;
      /**
       * URL of the resources to set breakpoint on.
       */
      url?: string;
      /**
       * Regex pattern for the URLs of the resources to set breakpoints on. Either `url` or
`urlRegex` must be specified.
       */
      urlRegex?: string;
      /**
       * Script hash of the resources to set breakpoint on.
       */
      scriptHash?: string;
      /**
       * Offset in the line to set breakpoint at.
       */
      columnNumber?: number;
      /**
       * Expression to use as a breakpoint condition. When specified, debugger will only stop on the
breakpoint if this expression evaluates to true.
       */
      condition?: string;
    }
    export type setBreakpointByUrlReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
      /**
       * List of the locations this breakpoint resolved into upon addition.
       */
      locations: Location[];
    }
    /**
     * Sets JavaScript breakpoint before each call to the given function.
If another function was created from the same source as a given one,
calling it will also trigger the breakpoint.
     */
    export type setBreakpointOnFunctionCallParameters = {
      /**
       * Function object id.
       */
      objectId: Runtime.RemoteObjectId;
      /**
       * Expression to use as a breakpoint condition. When specified, debugger will
stop on the breakpoint if this expression evaluates to true.
       */
      condition?: string;
    }
    export type setBreakpointOnFunctionCallReturnValue = {
      /**
       * Id of the created breakpoint for further reference.
       */
      breakpointId: BreakpointId;
    }
    /**
     * Activates / deactivates all breakpoints on the page.
     */
    export type setBreakpointsActiveParameters = {
      /**
       * New value for breakpoints active state.
       */
      active: boolean;
    }
    export type setBreakpointsActiveReturnValue = {
    }
    /**
     * Defines pause on exceptions state. Can be set to stop on all exceptions, uncaught exceptions or
no exceptions. Initial pause on exceptions state is `none`.
     */
    export type setPauseOnExceptionsParameters = {
      /**
       * Pause on exceptions mode.
       */
      state: "none"|"uncaught"|"all";
    }
    export type setPauseOnExceptionsReturnValue = {
    }
    /**
     * Changes return value in top frame. Available only at return break position.
     */
    export type setReturnValueParameters = {
      /**
       * New return value.
       */
      newValue: Runtime.CallArgument;
    }
    export type setReturnValueReturnValue = {
    }
    /**
     * Edits JavaScript source live.
     */
    export type setScriptSourceParameters = {
      /**
       * Id of the script to edit.
       */
      scriptId: Runtime.ScriptId;
      /**
       * New content of the script.
       */
      scriptSource: string;
      /**
       * If true the change will not actually be applied. Dry run may be used to get result
description without actually modifying the code.
       */
      dryRun?: boolean;
    }
    export type setScriptSourceReturnValue = {
      /**
       * New stack trace in case editing has happened while VM was stopped.
       */
      callFrames?: CallFrame[];
      /**
       * Whether current call stack  was modified after applying the changes.
       */
      stackChanged?: boolean;
      /**
       * Async stack trace, if any.
       */
      asyncStackTrace?: Runtime.StackTrace;
      /**
       * Async stack trace, if any.
       */
      asyncStackTraceId?: Runtime.StackTraceId;
      /**
       * Exception details if any.
       */
      exceptionDetails?: Runtime.ExceptionDetails;
    }
    /**
     * Makes page not interrupt on any pauses (breakpoint, exception, dom exception etc).
     */
    export type setSkipAllPausesParameters = {
      /**
       * New value for skip pauses state.
       */
      skip: boolean;
    }
    export type setSkipAllPausesReturnValue = {
    }
    /**
     * Changes value of variable in a callframe. Object-based scopes are not supported and must be
mutated manually.
     */
    export type setVariableValueParameters = {
      /**
       * 0-based number of scope as was listed in scope chain. Only 'local', 'closure' and 'catch'
scope types are allowed. Other scopes could be manipulated manually.
       */
      scopeNumber: number;
      /**
       * Variable name.
       */
      variableName: string;
      /**
       * New variable value.
       */
      newValue: Runtime.CallArgument;
      /**
       * Id of callframe that holds variable.
       */
      callFrameId: CallFrameId;
    }
    export type setVariableValueReturnValue = {
    }
    /**
     * Steps into the function call.
     */
    export type stepIntoParameters = {
      /**
       * Debugger will pause on the execution of the first async task which was scheduled
before next pause.
       */
      breakOnAsyncCall?: boolean;
      /**
       * The skipList specifies location ranges that should be skipped on step into.
       */
      skipList?: LocationRange[];
    }
    export type stepIntoReturnValue = {
    }
    /**
     * Steps out of the function call.
     */
    export type stepOutParameters = {
    }
    export type stepOutReturnValue = {
    }
    /**
     * Steps over the statement.
     */
    export type stepOverParameters = {
      /**
       * The skipList specifies location ranges that should be skipped on step over.
       */
      skipList?: LocationRange[];
    }
    export type stepOverReturnValue = {
    }
  }
  
  export module HeapProfiler {
    /**
     * Heap snapshot object id.
     */
    export type HeapSnapshotObjectId = string;
    /**
     * Sampling Heap Profile node. Holds callsite information, allocation statistics and child nodes.
     */
    export interface SamplingHeapProfileNode {
      /**
       * Function location.
       */
      callFrame: Runtime.CallFrame;
      /**
       * Allocations size in bytes for the node excluding children.
       */
      selfSize: number;
      /**
       * Node id. Ids are unique across all profiles collected between startSampling and stopSampling.
       */
      id: number;
      /**
       * Child nodes.
       */
      children: SamplingHeapProfileNode[];
    }
    /**
     * A single sample from a sampling profile.
     */
    export interface SamplingHeapProfileSample {
      /**
       * Allocation size in bytes attributed to the sample.
       */
      size: number;
      /**
       * Id of the corresponding profile tree node.
       */
      nodeId: number;
      /**
       * Time-ordered sample ordinal number. It is unique across all profiles retrieved
between startSampling and stopSampling.
       */
      ordinal: number;
    }
    /**
     * Sampling profile.
     */
    export interface SamplingHeapProfile {
      head: SamplingHeapProfileNode;
      samples: SamplingHeapProfileSample[];
    }
    
    export type addHeapSnapshotChunkPayload = {
      chunk: string;
    }
    /**
     * If heap objects tracking has been started then backend may send update for one or more fragments
     */
    export type heapStatsUpdatePayload = {
      /**
       * An array of triplets. Each triplet describes a fragment. The first integer is the fragment
index, the second integer is a total count of objects for the fragment, the third integer is
a total size of the objects for the fragment.
       */
      statsUpdate: number[];
    }
    /**
     * If heap objects tracking has been started then backend regularly sends a current value for last
seen object id and corresponding timestamp. If the were changes in the heap since last event
then one or more heapStatsUpdate events will be sent before a new lastSeenObjectId event.
     */
    export type lastSeenObjectIdPayload = {
      lastSeenObjectId: number;
      timestamp: number;
    }
    export type reportHeapSnapshotProgressPayload = {
      done: number;
      total: number;
      finished?: boolean;
    }
    export type resetProfilesPayload = void;
    
    /**
     * Enables console to refer to the node with given id via $x (see Command Line API for more details
$x functions).
     */
    export type addInspectedHeapObjectParameters = {
      /**
       * Heap snapshot object id to be accessible by means of $x command line API.
       */
      heapObjectId: HeapSnapshotObjectId;
    }
    export type addInspectedHeapObjectReturnValue = {
    }
    export type collectGarbageParameters = {
    }
    export type collectGarbageReturnValue = {
    }
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    export type getHeapObjectIdParameters = {
      /**
       * Identifier of the object to get heap object id for.
       */
      objectId: Runtime.RemoteObjectId;
    }
    export type getHeapObjectIdReturnValue = {
      /**
       * Id of the heap snapshot object corresponding to the passed remote object id.
       */
      heapSnapshotObjectId: HeapSnapshotObjectId;
    }
    export type getObjectByHeapObjectIdParameters = {
      objectId: HeapSnapshotObjectId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
    }
    export type getObjectByHeapObjectIdReturnValue = {
      /**
       * Evaluation result.
       */
      result: Runtime.RemoteObject;
    }
    export type getSamplingProfileParameters = {
    }
    export type getSamplingProfileReturnValue = {
      /**
       * Return the sampling profile being collected.
       */
      profile: SamplingHeapProfile;
    }
    export type startSamplingParameters = {
      /**
       * Average sample interval in bytes. Poisson distribution is used for the intervals. The
default value is 32768 bytes.
       */
      samplingInterval?: number;
    }
    export type startSamplingReturnValue = {
    }
    export type startTrackingHeapObjectsParameters = {
      trackAllocations?: boolean;
    }
    export type startTrackingHeapObjectsReturnValue = {
    }
    export type stopSamplingParameters = {
    }
    export type stopSamplingReturnValue = {
      /**
       * Recorded sampling heap profile.
       */
      profile: SamplingHeapProfile;
    }
    export type stopTrackingHeapObjectsParameters = {
      /**
       * If true 'reportHeapSnapshotProgress' events will be generated while snapshot is being taken
when the tracking is stopped.
       */
      reportProgress?: boolean;
      treatGlobalObjectsAsRoots?: boolean;
      /**
       * If true, numerical values are included in the snapshot
       */
      captureNumericValue?: boolean;
    }
    export type stopTrackingHeapObjectsReturnValue = {
    }
    export type takeHeapSnapshotParameters = {
      /**
       * If true 'reportHeapSnapshotProgress' events will be generated while snapshot is being taken.
       */
      reportProgress?: boolean;
      /**
       * If true, a raw snapshot without artificial roots will be generated
       */
      treatGlobalObjectsAsRoots?: boolean;
      /**
       * If true, numerical values are included in the snapshot
       */
      captureNumericValue?: boolean;
    }
    export type takeHeapSnapshotReturnValue = {
    }
  }
  
  export module Profiler {
    /**
     * Profile node. Holds callsite information, execution statistics and child nodes.
     */
    export interface ProfileNode {
      /**
       * Unique id of the node.
       */
      id: number;
      /**
       * Function location.
       */
      callFrame: Runtime.CallFrame;
      /**
       * Number of samples where this node was on top of the call stack.
       */
      hitCount?: number;
      /**
       * Child node ids.
       */
      children?: number[];
      /**
       * The reason of being not optimized. The function may be deoptimized or marked as don't
optimize.
       */
      deoptReason?: string;
      /**
       * An array of source position ticks.
       */
      positionTicks?: PositionTickInfo[];
    }
    /**
     * Profile.
     */
    export interface Profile {
      /**
       * The list of profile nodes. First item is the root node.
       */
      nodes: ProfileNode[];
      /**
       * Profiling start timestamp in microseconds.
       */
      startTime: number;
      /**
       * Profiling end timestamp in microseconds.
       */
      endTime: number;
      /**
       * Ids of samples top nodes.
       */
      samples?: number[];
      /**
       * Time intervals between adjacent samples in microseconds. The first delta is relative to the
profile startTime.
       */
      timeDeltas?: number[];
    }
    /**
     * Specifies a number of samples attributed to a certain source position.
     */
    export interface PositionTickInfo {
      /**
       * Source line number (1-based).
       */
      line: number;
      /**
       * Number of samples attributed to the source line.
       */
      ticks: number;
    }
    /**
     * Coverage data for a source range.
     */
    export interface CoverageRange {
      /**
       * JavaScript script source offset for the range start.
       */
      startOffset: number;
      /**
       * JavaScript script source offset for the range end.
       */
      endOffset: number;
      /**
       * Collected execution count of the source range.
       */
      count: number;
    }
    /**
     * Coverage data for a JavaScript function.
     */
    export interface FunctionCoverage {
      /**
       * JavaScript function name.
       */
      functionName: string;
      /**
       * Source ranges inside the function with coverage data.
       */
      ranges: CoverageRange[];
      /**
       * Whether coverage data for this function has block granularity.
       */
      isBlockCoverage: boolean;
    }
    /**
     * Coverage data for a JavaScript script.
     */
    export interface ScriptCoverage {
      /**
       * JavaScript script id.
       */
      scriptId: Runtime.ScriptId;
      /**
       * JavaScript script name or url.
       */
      url: string;
      /**
       * Functions contained in the script that has coverage data.
       */
      functions: FunctionCoverage[];
    }
    /**
     * Describes a type collected during runtime.
     */
    export interface TypeObject {
      /**
       * Name of a type collected with type profiling.
       */
      name: string;
    }
    /**
     * Source offset and types for a parameter or return value.
     */
    export interface TypeProfileEntry {
      /**
       * Source offset of the parameter or end of function for return values.
       */
      offset: number;
      /**
       * The types for this parameter or return value.
       */
      types: TypeObject[];
    }
    /**
     * Type profile data collected during runtime for a JavaScript script.
     */
    export interface ScriptTypeProfile {
      /**
       * JavaScript script id.
       */
      scriptId: Runtime.ScriptId;
      /**
       * JavaScript script name or url.
       */
      url: string;
      /**
       * Type profile entries for parameters and return values of the functions in the script.
       */
      entries: TypeProfileEntry[];
    }
    /**
     * Collected counter information.
     */
    export interface CounterInfo {
      /**
       * Counter name.
       */
      name: string;
      /**
       * Counter value.
       */
      value: number;
    }
    /**
     * Runtime call counter information.
     */
    export interface RuntimeCallCounterInfo {
      /**
       * Counter name.
       */
      name: string;
      /**
       * Counter value.
       */
      value: number;
      /**
       * Counter time in seconds.
       */
      time: number;
    }
    
    export type consoleProfileFinishedPayload = {
      id: string;
      /**
       * Location of console.profileEnd().
       */
      location: Debugger.Location;
      profile: Profile;
      /**
       * Profile title passed as an argument to console.profile().
       */
      title?: string;
    }
    /**
     * Sent when new profile recording is started using console.profile() call.
     */
    export type consoleProfileStartedPayload = {
      id: string;
      /**
       * Location of console.profile().
       */
      location: Debugger.Location;
      /**
       * Profile title passed as an argument to console.profile().
       */
      title?: string;
    }
    /**
     * Reports coverage delta since the last poll (either from an event like this, or from
`takePreciseCoverage` for the current isolate. May only be sent if precise code
coverage has been started. This event can be trigged by the embedder to, for example,
trigger collection of coverage data immediately at a certain point in time.
     */
    export type preciseCoverageDeltaUpdatePayload = {
      /**
       * Monotonically increasing time (in seconds) when the coverage update was taken in the backend.
       */
      timestamp: number;
      /**
       * Identifier for distinguishing coverage events.
       */
      occasion: string;
      /**
       * Coverage data for the current isolate.
       */
      result: ScriptCoverage[];
    }
    
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Collect coverage data for the current isolate. The coverage data may be incomplete due to
garbage collection.
     */
    export type getBestEffortCoverageParameters = {
    }
    export type getBestEffortCoverageReturnValue = {
      /**
       * Coverage data for the current isolate.
       */
      result: ScriptCoverage[];
    }
    /**
     * Changes CPU profiler sampling interval. Must be called before CPU profiles recording started.
     */
    export type setSamplingIntervalParameters = {
      /**
       * New sampling interval in microseconds.
       */
      interval: number;
    }
    export type setSamplingIntervalReturnValue = {
    }
    export type startParameters = {
    }
    export type startReturnValue = {
    }
    /**
     * Enable precise code coverage. Coverage data for JavaScript executed before enabling precise code
coverage may be incomplete. Enabling prevents running optimized code and resets execution
counters.
     */
    export type startPreciseCoverageParameters = {
      /**
       * Collect accurate call counts beyond simple 'covered' or 'not covered'.
       */
      callCount?: boolean;
      /**
       * Collect block-based coverage.
       */
      detailed?: boolean;
      /**
       * Allow the backend to send updates on its own initiative
       */
      allowTriggeredUpdates?: boolean;
    }
    export type startPreciseCoverageReturnValue = {
      /**
       * Monotonically increasing time (in seconds) when the coverage update was taken in the backend.
       */
      timestamp: number;
    }
    /**
     * Enable type profile.
     */
    export type startTypeProfileParameters = {
    }
    export type startTypeProfileReturnValue = {
    }
    export type stopParameters = {
    }
    export type stopReturnValue = {
      /**
       * Recorded profile.
       */
      profile: Profile;
    }
    /**
     * Disable precise code coverage. Disabling releases unnecessary execution count records and allows
executing optimized code.
     */
    export type stopPreciseCoverageParameters = {
    }
    export type stopPreciseCoverageReturnValue = {
    }
    /**
     * Disable type profile. Disabling releases type profile data collected so far.
     */
    export type stopTypeProfileParameters = {
    }
    export type stopTypeProfileReturnValue = {
    }
    /**
     * Collect coverage data for the current isolate, and resets execution counters. Precise code
coverage needs to have started.
     */
    export type takePreciseCoverageParameters = {
    }
    export type takePreciseCoverageReturnValue = {
      /**
       * Coverage data for the current isolate.
       */
      result: ScriptCoverage[];
      /**
       * Monotonically increasing time (in seconds) when the coverage update was taken in the backend.
       */
      timestamp: number;
    }
    /**
     * Collect type profile.
     */
    export type takeTypeProfileParameters = {
    }
    export type takeTypeProfileReturnValue = {
      /**
       * Type profile for all scripts since startTypeProfile() was turned on.
       */
      result: ScriptTypeProfile[];
    }
    /**
     * Enable counters collection.
     */
    export type enableCountersParameters = {
    }
    export type enableCountersReturnValue = {
    }
    /**
     * Disable counters collection.
     */
    export type disableCountersParameters = {
    }
    export type disableCountersReturnValue = {
    }
    /**
     * Retrieve counters.
     */
    export type getCountersParameters = {
    }
    export type getCountersReturnValue = {
      /**
       * Collected counters information.
       */
      result: CounterInfo[];
    }
    /**
     * Enable run time call stats collection.
     */
    export type enableRuntimeCallStatsParameters = {
    }
    export type enableRuntimeCallStatsReturnValue = {
    }
    /**
     * Disable run time call stats collection.
     */
    export type disableRuntimeCallStatsParameters = {
    }
    export type disableRuntimeCallStatsReturnValue = {
    }
    /**
     * Retrieve run time call stats.
     */
    export type getRuntimeCallStatsParameters = {
    }
    export type getRuntimeCallStatsReturnValue = {
      /**
       * Collected runtime call counter information.
       */
      result: RuntimeCallCounterInfo[];
    }
  }
  
  /**
   * Runtime domain exposes JavaScript runtime by means of remote evaluation and mirror objects.
Evaluation results are returned as mirror object that expose object type, string representation
and unique identifier that can be used for further object reference. Original objects are
maintained in memory unless they are either explicitly released or are released along with the
other objects in their object group.
   */
  export module Runtime {
    /**
     * Unique script identifier.
     */
    export type ScriptId = string;
    /**
     * Unique object identifier.
     */
    export type RemoteObjectId = string;
    /**
     * Primitive value which cannot be JSON-stringified. Includes values `-0`, `NaN`, `Infinity`,
`-Infinity`, and bigint literals.
     */
    export type UnserializableValue = string;
    /**
     * Mirror object referencing original JavaScript object.
     */
    export interface RemoteObject {
      /**
       * Object type.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint";
      /**
       * Object subtype hint. Specified for `object` type values only.
NOTE: If you change anything here, make sure to also update
`subtype` in `ObjectPreview` and `PropertyPreview` below.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"generator"|"error"|"proxy"|"promise"|"typedarray"|"arraybuffer"|"dataview"|"webassemblymemory"|"wasmvalue";
      /**
       * Object class (constructor) name. Specified for `object` type values only.
       */
      className?: string;
      /**
       * Remote object value in case of primitive values or JSON values (if it was requested).
       */
      value?: any;
      /**
       * Primitive value which can not be JSON-stringified does not have `value`, but gets this
property.
       */
      unserializableValue?: UnserializableValue;
      /**
       * String representation of the object.
       */
      description?: string;
      /**
       * Unique object identifier (for non-primitive values).
       */
      objectId?: RemoteObjectId;
      /**
       * Preview containing abbreviated property values. Specified for `object` type values only.
       */
      preview?: ObjectPreview;
      customPreview?: CustomPreview;
    }
    export interface CustomPreview {
      /**
       * The JSON-stringified result of formatter.header(object, config) call.
It contains json ML array that represents RemoteObject.
       */
      header: string;
      /**
       * If formatter returns true as a result of formatter.hasBody call then bodyGetterId will
contain RemoteObjectId for the function that returns result of formatter.body(object, config) call.
The result value is json ML array.
       */
      bodyGetterId?: RemoteObjectId;
    }
    /**
     * Object containing abbreviated remote object value.
     */
    export interface ObjectPreview {
      /**
       * Object type.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"bigint";
      /**
       * Object subtype hint. Specified for `object` type values only.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"generator"|"error"|"proxy"|"promise"|"typedarray"|"arraybuffer"|"dataview"|"webassemblymemory"|"wasmvalue";
      /**
       * String representation of the object.
       */
      description?: string;
      /**
       * True iff some of the properties or entries of the original object did not fit.
       */
      overflow: boolean;
      /**
       * List of the properties.
       */
      properties: PropertyPreview[];
      /**
       * List of the entries. Specified for `map` and `set` subtype values only.
       */
      entries?: EntryPreview[];
    }
    export interface PropertyPreview {
      /**
       * Property name.
       */
      name: string;
      /**
       * Object type. Accessor means that the property itself is an accessor property.
       */
      type: "object"|"function"|"undefined"|"string"|"number"|"boolean"|"symbol"|"accessor"|"bigint";
      /**
       * User-friendly property value string.
       */
      value?: string;
      /**
       * Nested value preview.
       */
      valuePreview?: ObjectPreview;
      /**
       * Object subtype hint. Specified for `object` type values only.
       */
      subtype?: "array"|"null"|"node"|"regexp"|"date"|"map"|"set"|"weakmap"|"weakset"|"iterator"|"generator"|"error"|"proxy"|"promise"|"typedarray"|"arraybuffer"|"dataview"|"webassemblymemory"|"wasmvalue";
    }
    export interface EntryPreview {
      /**
       * Preview of the key. Specified for map-like collection entries.
       */
      key?: ObjectPreview;
      /**
       * Preview of the value.
       */
      value: ObjectPreview;
    }
    /**
     * Object property descriptor.
     */
    export interface PropertyDescriptor {
      /**
       * Property name or symbol description.
       */
      name: string;
      /**
       * The value associated with the property.
       */
      value?: RemoteObject;
      /**
       * True if the value associated with the property may be changed (data descriptors only).
       */
      writable?: boolean;
      /**
       * A function which serves as a getter for the property, or `undefined` if there is no getter
(accessor descriptors only).
       */
      get?: RemoteObject;
      /**
       * A function which serves as a setter for the property, or `undefined` if there is no setter
(accessor descriptors only).
       */
      set?: RemoteObject;
      /**
       * True if the type of this property descriptor may be changed and if the property may be
deleted from the corresponding object.
       */
      configurable: boolean;
      /**
       * True if this property shows up during enumeration of the properties on the corresponding
object.
       */
      enumerable: boolean;
      /**
       * True if the result was thrown during the evaluation.
       */
      wasThrown?: boolean;
      /**
       * True if the property is owned for the object.
       */
      isOwn?: boolean;
      /**
       * Property symbol object, if the property is of the `symbol` type.
       */
      symbol?: RemoteObject;
    }
    /**
     * Object internal property descriptor. This property isn't normally visible in JavaScript code.
     */
    export interface InternalPropertyDescriptor {
      /**
       * Conventional property name.
       */
      name: string;
      /**
       * The value associated with the property.
       */
      value?: RemoteObject;
    }
    /**
     * Object private field descriptor.
     */
    export interface PrivatePropertyDescriptor {
      /**
       * Private property name.
       */
      name: string;
      /**
       * The value associated with the private property.
       */
      value?: RemoteObject;
      /**
       * A function which serves as a getter for the private property,
or `undefined` if there is no getter (accessor descriptors only).
       */
      get?: RemoteObject;
      /**
       * A function which serves as a setter for the private property,
or `undefined` if there is no setter (accessor descriptors only).
       */
      set?: RemoteObject;
    }
    /**
     * Represents function call argument. Either remote object id `objectId`, primitive `value`,
unserializable primitive value or neither of (for undefined) them should be specified.
     */
    export interface CallArgument {
      /**
       * Primitive value or serializable javascript object.
       */
      value?: any;
      /**
       * Primitive value which can not be JSON-stringified.
       */
      unserializableValue?: UnserializableValue;
      /**
       * Remote object handle.
       */
      objectId?: RemoteObjectId;
    }
    /**
     * Id of an execution context.
     */
    export type ExecutionContextId = number;
    /**
     * Description of an isolated world.
     */
    export interface ExecutionContextDescription {
      /**
       * Unique id of the execution context. It can be used to specify in which execution context
script evaluation should be performed.
       */
      id: ExecutionContextId;
      /**
       * Execution context origin.
       */
      origin: string;
      /**
       * Human readable name describing given context.
       */
      name: string;
      /**
       * A system-unique execution context identifier. Unlike the id, this is unique across
multiple processes, so can be reliably used to identify specific context while backend
performs a cross-process navigation.
       */
      uniqueId: string;
      /**
       * Embedder-specific auxiliary data.
       */
      auxData?: { [key: string]: string };
    }
    /**
     * Detailed information about exception (or error) that was thrown during script compilation or
execution.
     */
    export interface ExceptionDetails {
      /**
       * Exception id.
       */
      exceptionId: number;
      /**
       * Exception text, which should be used together with exception object when available.
       */
      text: string;
      /**
       * Line number of the exception location (0-based).
       */
      lineNumber: number;
      /**
       * Column number of the exception location (0-based).
       */
      columnNumber: number;
      /**
       * Script ID of the exception location.
       */
      scriptId?: ScriptId;
      /**
       * URL of the exception location, to be used when the script was not reported.
       */
      url?: string;
      /**
       * JavaScript stack trace if available.
       */
      stackTrace?: StackTrace;
      /**
       * Exception object if available.
       */
      exception?: RemoteObject;
      /**
       * Identifier of the context where exception happened.
       */
      executionContextId?: ExecutionContextId;
      /**
       * Dictionary with entries of meta data that the client associated
with this exception, such as information about associated network
requests, etc.
       */
      exceptionMetaData?: { [key: string]: string };
    }
    /**
     * Number of milliseconds since epoch.
     */
    export type Timestamp = number;
    /**
     * Number of milliseconds.
     */
    export type TimeDelta = number;
    /**
     * Stack entry for runtime errors and assertions.
     */
    export interface CallFrame {
      /**
       * JavaScript function name.
       */
      functionName: string;
      /**
       * JavaScript script id.
       */
      scriptId: ScriptId;
      /**
       * JavaScript script name or url.
       */
      url: string;
      /**
       * JavaScript script line number (0-based).
       */
      lineNumber: number;
      /**
       * JavaScript script column number (0-based).
       */
      columnNumber: number;
    }
    /**
     * Call frames for assertions or error messages.
     */
    export interface StackTrace {
      /**
       * String label of this stack trace. For async traces this may be a name of the function that
initiated the async call.
       */
      description?: string;
      /**
       * JavaScript function name.
       */
      callFrames: CallFrame[];
      /**
       * Asynchronous JavaScript stack trace that preceded this stack, if available.
       */
      parent?: StackTrace;
      /**
       * Asynchronous JavaScript stack trace that preceded this stack, if available.
       */
      parentId?: StackTraceId;
    }
    /**
     * Unique identifier of current debugger.
     */
    export type UniqueDebuggerId = string;
    /**
     * If `debuggerId` is set stack trace comes from another debugger and can be resolved there. This
allows to track cross-debugger calls. See `Runtime.StackTrace` and `Debugger.paused` for usages.
     */
    export interface StackTraceId {
      id: string;
      debuggerId?: UniqueDebuggerId;
    }
    
    /**
     * Notification is issued every time when binding is called.
     */
    export type bindingCalledPayload = {
      name: string;
      payload: string;
      /**
       * Identifier of the context where the call was made.
       */
      executionContextId: ExecutionContextId;
    }
    /**
     * Issued when console API was called.
     */
    export type consoleAPICalledPayload = {
      /**
       * Type of the call.
       */
      type: "log"|"debug"|"info"|"error"|"warning"|"dir"|"dirxml"|"table"|"trace"|"clear"|"startGroup"|"startGroupCollapsed"|"endGroup"|"assert"|"profile"|"profileEnd"|"count"|"timeEnd";
      /**
       * Call arguments.
       */
      args: RemoteObject[];
      /**
       * Identifier of the context where the call was made.
       */
      executionContextId: ExecutionContextId;
      /**
       * Call timestamp.
       */
      timestamp: Timestamp;
      /**
       * Stack trace captured when the call was made. The async stack chain is automatically reported for
the following call types: `assert`, `error`, `trace`, `warning`. For other types the async call
chain can be retrieved using `Debugger.getStackTrace` and `stackTrace.parentId` field.
       */
      stackTrace?: StackTrace;
      /**
       * Console context descriptor for calls on non-default console context (not console.*):
'anonymous#unique-logger-id' for call on unnamed context, 'name#unique-logger-id' for call
on named context.
       */
      context?: string;
    }
    /**
     * Issued when unhandled exception was revoked.
     */
    export type exceptionRevokedPayload = {
      /**
       * Reason describing why exception was revoked.
       */
      reason: string;
      /**
       * The id of revoked exception, as reported in `exceptionThrown`.
       */
      exceptionId: number;
    }
    /**
     * Issued when exception was thrown and unhandled.
     */
    export type exceptionThrownPayload = {
      /**
       * Timestamp of the exception.
       */
      timestamp: Timestamp;
      exceptionDetails: ExceptionDetails;
    }
    /**
     * Issued when new execution context is created.
     */
    export type executionContextCreatedPayload = {
      /**
       * A newly created execution context.
       */
      context: ExecutionContextDescription;
    }
    /**
     * Issued when execution context is destroyed.
     */
    export type executionContextDestroyedPayload = {
      /**
       * Id of the destroyed context
       */
      executionContextId: ExecutionContextId;
    }
    /**
     * Issued when all executionContexts were cleared in browser
     */
    export type executionContextsClearedPayload = void;
    /**
     * Issued when object should be inspected (for example, as a result of inspect() command line API
call).
     */
    export type inspectRequestedPayload = {
      object: RemoteObject;
      hints: { [key: string]: string };
      /**
       * Identifier of the context where the call was made.
       */
      executionContextId?: ExecutionContextId;
    }
    
    /**
     * Add handler to promise with given promise object id.
     */
    export type awaitPromiseParameters = {
      /**
       * Identifier of the promise.
       */
      promiseObjectId: RemoteObjectId;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
    }
    export type awaitPromiseReturnValue = {
      /**
       * Promise result. Will contain rejected value if promise was rejected.
       */
      result: RemoteObject;
      /**
       * Exception details if stack strace is available.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Calls function with given declaration on the given object. Object group of the result is
inherited from the target object.
     */
    export type callFunctionOnParameters = {
      /**
       * Declaration of the function to call.
       */
      functionDeclaration: string;
      /**
       * Identifier of the object to call function on. Either objectId or executionContextId should
be specified.
       */
      objectId?: RemoteObjectId;
      /**
       * Call arguments. All call arguments must belong to the same JavaScript world as the target
object.
       */
      arguments?: CallArgument[];
      /**
       * In silent mode exceptions thrown during evaluation are not reported and do not pause
execution. Overrides `setPauseOnException` state.
       */
      silent?: boolean;
      /**
       * Whether the result is expected to be a JSON object which should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether execution should be treated as initiated by user in the UI.
       */
      userGesture?: boolean;
      /**
       * Whether execution should `await` for resulting value and return once awaited promise is
resolved.
       */
      awaitPromise?: boolean;
      /**
       * Specifies execution context which global object will be used to call function on. Either
executionContextId or objectId should be specified.
       */
      executionContextId?: ExecutionContextId;
      /**
       * Symbolic group name that can be used to release multiple objects. If objectGroup is not
specified and objectId is, objectGroup will be inherited from object.
       */
      objectGroup?: string;
      /**
       * Whether to throw an exception if side effect cannot be ruled out during evaluation.
       */
      throwOnSideEffect?: boolean;
    }
    export type callFunctionOnReturnValue = {
      /**
       * Call result.
       */
      result: RemoteObject;
      /**
       * Exception details.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Compiles expression.
     */
    export type compileScriptParameters = {
      /**
       * Expression to compile.
       */
      expression: string;
      /**
       * Source url to be set for the script.
       */
      sourceURL: string;
      /**
       * Specifies whether the compiled script should be persisted.
       */
      persistScript: boolean;
      /**
       * Specifies in which execution context to perform script run. If the parameter is omitted the
evaluation will be performed in the context of the inspected page.
       */
      executionContextId?: ExecutionContextId;
    }
    export type compileScriptReturnValue = {
      /**
       * Id of the script.
       */
      scriptId?: ScriptId;
      /**
       * Exception details.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Disables reporting of execution contexts creation.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Discards collected exceptions and console API calls.
     */
    export type discardConsoleEntriesParameters = {
    }
    export type discardConsoleEntriesReturnValue = {
    }
    /**
     * Enables reporting of execution contexts creation by means of `executionContextCreated` event.
When the reporting gets enabled the event will be sent immediately for each existing execution
context.
     */
    export type enableParameters = {
    }
    export type enableReturnValue = {
    }
    /**
     * Evaluates expression on global object.
     */
    export type evaluateParameters = {
      /**
       * Expression to evaluate.
       */
      expression: string;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
      /**
       * Determines whether Command Line API should be available during the evaluation.
       */
      includeCommandLineAPI?: boolean;
      /**
       * In silent mode exceptions thrown during evaluation are not reported and do not pause
execution. Overrides `setPauseOnException` state.
       */
      silent?: boolean;
      /**
       * Specifies in which execution context to perform evaluation. If the parameter is omitted the
evaluation will be performed in the context of the inspected page.
This is mutually exclusive with `uniqueContextId`, which offers an
alternative way to identify the execution context that is more reliable
in a multi-process environment.
       */
      contextId?: ExecutionContextId;
      /**
       * Whether the result is expected to be a JSON object that should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether execution should be treated as initiated by user in the UI.
       */
      userGesture?: boolean;
      /**
       * Whether execution should `await` for resulting value and return once awaited promise is
resolved.
       */
      awaitPromise?: boolean;
      /**
       * Whether to throw an exception if side effect cannot be ruled out during evaluation.
This implies `disableBreaks` below.
       */
      throwOnSideEffect?: boolean;
      /**
       * Terminate execution after timing out (number of milliseconds).
       */
      timeout?: TimeDelta;
      /**
       * Disable breakpoints during execution.
       */
      disableBreaks?: boolean;
      /**
       * Setting this flag to true enables `let` re-declaration and top-level `await`.
Note that `let` variables can only be re-declared if they originate from
`replMode` themselves.
       */
      replMode?: boolean;
      /**
       * The Content Security Policy (CSP) for the target might block 'unsafe-eval'
which includes eval(), Function(), setTimeout() and setInterval()
when called with non-callable arguments. This flag bypasses CSP for this
evaluation and allows unsafe-eval. Defaults to true.
       */
      allowUnsafeEvalBlockedByCSP?: boolean;
      /**
       * An alternative way to specify the execution context to evaluate in.
Compared to contextId that may be reused across processes, this is guaranteed to be
system-unique, so it can be used to prevent accidental evaluation of the expression
in context different than intended (e.g. as a result of navigation across process
boundaries).
This is mutually exclusive with `contextId`.
       */
      uniqueContextId?: string;
    }
    export type evaluateReturnValue = {
      /**
       * Evaluation result.
       */
      result: RemoteObject;
      /**
       * Exception details.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Returns the isolate id.
     */
    export type getIsolateIdParameters = {
    }
    export type getIsolateIdReturnValue = {
      /**
       * The isolate id.
       */
      id: string;
    }
    /**
     * Returns the JavaScript heap usage.
It is the total usage of the corresponding isolate not scoped to a particular Runtime.
     */
    export type getHeapUsageParameters = {
    }
    export type getHeapUsageReturnValue = {
      /**
       * Used heap size in bytes.
       */
      usedSize: number;
      /**
       * Allocated heap size in bytes.
       */
      totalSize: number;
    }
    /**
     * Returns properties of a given object. Object group of the result is inherited from the target
object.
     */
    export type getPropertiesParameters = {
      /**
       * Identifier of the object to return properties for.
       */
      objectId: RemoteObjectId;
      /**
       * If true, returns properties belonging only to the element itself, not to its prototype
chain.
       */
      ownProperties?: boolean;
      /**
       * If true, returns accessor properties (with getter/setter) only; internal properties are not
returned either.
       */
      accessorPropertiesOnly?: boolean;
      /**
       * Whether preview should be generated for the results.
       */
      generatePreview?: boolean;
    }
    export type getPropertiesReturnValue = {
      /**
       * Object properties.
       */
      result: PropertyDescriptor[];
      /**
       * Internal object properties (only of the element itself).
       */
      internalProperties?: InternalPropertyDescriptor[];
      /**
       * Object private properties.
       */
      privateProperties?: PrivatePropertyDescriptor[];
      /**
       * Exception details.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Returns all let, const and class variables from global scope.
     */
    export type globalLexicalScopeNamesParameters = {
      /**
       * Specifies in which execution context to lookup global scope variables.
       */
      executionContextId?: ExecutionContextId;
    }
    export type globalLexicalScopeNamesReturnValue = {
      names: string[];
    }
    export type queryObjectsParameters = {
      /**
       * Identifier of the prototype to return objects for.
       */
      prototypeObjectId: RemoteObjectId;
      /**
       * Symbolic group name that can be used to release the results.
       */
      objectGroup?: string;
    }
    export type queryObjectsReturnValue = {
      /**
       * Array with objects.
       */
      objects: RemoteObject;
    }
    /**
     * Releases remote object with given id.
     */
    export type releaseObjectParameters = {
      /**
       * Identifier of the object to release.
       */
      objectId: RemoteObjectId;
    }
    export type releaseObjectReturnValue = {
    }
    /**
     * Releases all remote objects that belong to a given group.
     */
    export type releaseObjectGroupParameters = {
      /**
       * Symbolic object group name.
       */
      objectGroup: string;
    }
    export type releaseObjectGroupReturnValue = {
    }
    /**
     * Tells inspected instance to run if it was waiting for debugger to attach.
     */
    export type runIfWaitingForDebuggerParameters = {
    }
    export type runIfWaitingForDebuggerReturnValue = {
    }
    /**
     * Runs script with given id in a given context.
     */
    export type runScriptParameters = {
      /**
       * Id of the script to run.
       */
      scriptId: ScriptId;
      /**
       * Specifies in which execution context to perform script run. If the parameter is omitted the
evaluation will be performed in the context of the inspected page.
       */
      executionContextId?: ExecutionContextId;
      /**
       * Symbolic group name that can be used to release multiple objects.
       */
      objectGroup?: string;
      /**
       * In silent mode exceptions thrown during evaluation are not reported and do not pause
execution. Overrides `setPauseOnException` state.
       */
      silent?: boolean;
      /**
       * Determines whether Command Line API should be available during the evaluation.
       */
      includeCommandLineAPI?: boolean;
      /**
       * Whether the result is expected to be a JSON object which should be sent by value.
       */
      returnByValue?: boolean;
      /**
       * Whether preview should be generated for the result.
       */
      generatePreview?: boolean;
      /**
       * Whether execution should `await` for resulting value and return once awaited promise is
resolved.
       */
      awaitPromise?: boolean;
    }
    export type runScriptReturnValue = {
      /**
       * Run result.
       */
      result: RemoteObject;
      /**
       * Exception details.
       */
      exceptionDetails?: ExceptionDetails;
    }
    /**
     * Enables or disables async call stacks tracking.
     */
    export type setAsyncCallStackDepthParameters = {
      /**
       * Maximum depth of async call stacks. Setting to `0` will effectively disable collecting async
call stacks (default).
       */
      maxDepth: number;
    }
    export type setAsyncCallStackDepthReturnValue = {
    }
    export type setCustomObjectFormatterEnabledParameters = {
      enabled: boolean;
    }
    export type setCustomObjectFormatterEnabledReturnValue = {
    }
    export type setMaxCallStackSizeToCaptureParameters = {
      size: number;
    }
    export type setMaxCallStackSizeToCaptureReturnValue = {
    }
    /**
     * Terminate current or next JavaScript execution.
Will cancel the termination when the outer-most script execution ends.
     */
    export type terminateExecutionParameters = {
    }
    export type terminateExecutionReturnValue = {
    }
    /**
     * If executionContextId is empty, adds binding with the given name on the
global objects of all inspected contexts, including those created later,
bindings survive reloads.
Binding function takes exactly one argument, this argument should be string,
in case of any other input, function throws an exception.
Each binding function call produces Runtime.bindingCalled notification.
     */
    export type addBindingParameters = {
      name: string;
      /**
       * If specified, the binding would only be exposed to the specified
execution context. If omitted and `executionContextName` is not set,
the binding is exposed to all execution contexts of the target.
This parameter is mutually exclusive with `executionContextName`.
Deprecated in favor of `executionContextName` due to an unclear use case
and bugs in implementation (crbug.com/1169639). `executionContextId` will be
removed in the future.
       */
      executionContextId?: ExecutionContextId;
      /**
       * If specified, the binding is exposed to the executionContext with
matching name, even for contexts created after the binding is added.
See also `ExecutionContext.name` and `worldName` parameter to
`Page.addScriptToEvaluateOnNewDocument`.
This parameter is mutually exclusive with `executionContextId`.
       */
      executionContextName?: string;
    }
    export type addBindingReturnValue = {
    }
    /**
     * This method does not remove binding function from global object but
unsubscribes current runtime agent from Runtime.bindingCalled notifications.
     */
    export type removeBindingParameters = {
      name: string;
    }
    export type removeBindingReturnValue = {
    }
  }
  
  /**
   * This domain is deprecated.
   */
  export module Schema {
    /**
     * Description of the protocol domain.
     */
    export interface Domain {
      /**
       * Domain name.
       */
      name: string;
      /**
       * Domain version.
       */
      version: string;
    }
    
    
    /**
     * Returns supported domains.
     */
    export type getDomainsParameters = {
    }
    export type getDomainsReturnValue = {
      /**
       * List of supported domains.
       */
      domains: Domain[];
    }
  }
  
  export module NodeTracing {
    export interface TraceConfig {
      /**
       * Controls how the trace buffer stores data.
       */
      recordMode?: "recordUntilFull"|"recordContinuously"|"recordAsMuchAsPossible";
      /**
       * Included category filters.
       */
      includedCategories: string[];
    }
    
    /**
     * Contains an bucket of collected trace events.
     */
    export type dataCollectedPayload = {
      value: { [key: string]: string }[];
    }
    /**
     * Signals that tracing is stopped and there is no trace buffers pending flush, all data were
delivered via dataCollected events.
     */
    export type tracingCompletePayload = void;
    
    /**
     * Gets supported tracing categories.
     */
    export type getCategoriesParameters = {
    }
    export type getCategoriesReturnValue = {
      /**
       * A list of supported tracing categories.
       */
      categories: string[];
    }
    /**
     * Start trace events collection.
     */
    export type startParameters = {
      traceConfig: TraceConfig;
    }
    export type startReturnValue = {
    }
    /**
     * Stop trace events collection. Remaining collected events will be sent as a sequence of
dataCollected events followed by tracingComplete event.
     */
    export type stopParameters = {
    }
    export type stopReturnValue = {
    }
  }
  
  /**
   * Support for sending messages to Node worker Inspector instances.
   */
  export module NodeWorker {
    export type WorkerID = string;
    /**
     * Unique identifier of attached debugging session.
     */
    export type SessionID = string;
    export interface WorkerInfo {
      workerId: WorkerID;
      type: string;
      title: string;
      url: string;
    }
    
    /**
     * Issued when attached to a worker.
     */
    export type attachedToWorkerPayload = {
      /**
       * Identifier assigned to the session used to send/receive messages.
       */
      sessionId: SessionID;
      workerInfo: WorkerInfo;
      waitingForDebugger: boolean;
    }
    /**
     * Issued when detached from the worker.
     */
    export type detachedFromWorkerPayload = {
      /**
       * Detached session identifier.
       */
      sessionId: SessionID;
    }
    /**
     * Notifies about a new protocol message received from the session
(session ID is provided in attachedToWorker notification).
     */
    export type receivedMessageFromWorkerPayload = {
      /**
       * Identifier of a session which sends a message.
       */
      sessionId: SessionID;
      message: string;
    }
    
    /**
     * Sends protocol message over session with given id.
     */
    export type sendMessageToWorkerParameters = {
      message: string;
      /**
       * Identifier of the session.
       */
      sessionId: SessionID;
    }
    export type sendMessageToWorkerReturnValue = {
    }
    /**
     * Instructs the inspector to attach to running workers. Will also attach to new workers
as they start
     */
    export type enableParameters = {
      /**
       * Whether to new workers should be paused until the frontend sends `Runtime.runIfWaitingForDebugger`
message to run them.
       */
      waitForDebuggerOnStart: boolean;
    }
    export type enableReturnValue = {
    }
    /**
     * Detaches from all running workers and disables attaching to new workers as they are started.
     */
    export type disableParameters = {
    }
    export type disableReturnValue = {
    }
    /**
     * Detached from the worker with given sessionId.
     */
    export type detachParameters = {
      sessionId: SessionID;
    }
    export type detachReturnValue = {
    }
  }
  
  /**
   * Support for inspecting node process state.
   */
  export module NodeRuntime {
    
    /**
     * This event is fired instead of `Runtime.executionContextDestroyed` when
enabled.
It is fired when the Node process finished all code execution and is
waiting for all frontends to disconnect.
     */
    export type waitingForDisconnectPayload = void;
    
    /**
     * Enable the `NodeRuntime.waitingForDisconnect`.
     */
    export type notifyWhenWaitingForDisconnectParameters = {
      enabled: boolean;
    }
    export type notifyWhenWaitingForDisconnectReturnValue = {
    }
  }
  
  export interface Events {
    "Console.messageAdded": Console.messageAddedPayload;
    "Debugger.breakpointResolved": Debugger.breakpointResolvedPayload;
    "Debugger.paused": Debugger.pausedPayload;
    "Debugger.resumed": Debugger.resumedPayload;
    "Debugger.scriptFailedToParse": Debugger.scriptFailedToParsePayload;
    "Debugger.scriptParsed": Debugger.scriptParsedPayload;
    "HeapProfiler.addHeapSnapshotChunk": HeapProfiler.addHeapSnapshotChunkPayload;
    "HeapProfiler.heapStatsUpdate": HeapProfiler.heapStatsUpdatePayload;
    "HeapProfiler.lastSeenObjectId": HeapProfiler.lastSeenObjectIdPayload;
    "HeapProfiler.reportHeapSnapshotProgress": HeapProfiler.reportHeapSnapshotProgressPayload;
    "HeapProfiler.resetProfiles": HeapProfiler.resetProfilesPayload;
    "Profiler.consoleProfileFinished": Profiler.consoleProfileFinishedPayload;
    "Profiler.consoleProfileStarted": Profiler.consoleProfileStartedPayload;
    "Profiler.preciseCoverageDeltaUpdate": Profiler.preciseCoverageDeltaUpdatePayload;
    "Runtime.bindingCalled": Runtime.bindingCalledPayload;
    "Runtime.consoleAPICalled": Runtime.consoleAPICalledPayload;
    "Runtime.exceptionRevoked": Runtime.exceptionRevokedPayload;
    "Runtime.exceptionThrown": Runtime.exceptionThrownPayload;
    "Runtime.executionContextCreated": Runtime.executionContextCreatedPayload;
    "Runtime.executionContextDestroyed": Runtime.executionContextDestroyedPayload;
    "Runtime.executionContextsCleared": Runtime.executionContextsClearedPayload;
    "Runtime.inspectRequested": Runtime.inspectRequestedPayload;
    "NodeTracing.dataCollected": NodeTracing.dataCollectedPayload;
    "NodeTracing.tracingComplete": NodeTracing.tracingCompletePayload;
    "NodeWorker.attachedToWorker": NodeWorker.attachedToWorkerPayload;
    "NodeWorker.detachedFromWorker": NodeWorker.detachedFromWorkerPayload;
    "NodeWorker.receivedMessageFromWorker": NodeWorker.receivedMessageFromWorkerPayload;
    "NodeRuntime.waitingForDisconnect": NodeRuntime.waitingForDisconnectPayload;
  }
  export interface CommandParameters {
    "Console.clearMessages": Console.clearMessagesParameters;
    "Console.disable": Console.disableParameters;
    "Console.enable": Console.enableParameters;
    "Debugger.continueToLocation": Debugger.continueToLocationParameters;
    "Debugger.disable": Debugger.disableParameters;
    "Debugger.enable": Debugger.enableParameters;
    "Debugger.evaluateOnCallFrame": Debugger.evaluateOnCallFrameParameters;
    "Debugger.getPossibleBreakpoints": Debugger.getPossibleBreakpointsParameters;
    "Debugger.getScriptSource": Debugger.getScriptSourceParameters;
    "Debugger.getWasmBytecode": Debugger.getWasmBytecodeParameters;
    "Debugger.getStackTrace": Debugger.getStackTraceParameters;
    "Debugger.pause": Debugger.pauseParameters;
    "Debugger.pauseOnAsyncCall": Debugger.pauseOnAsyncCallParameters;
    "Debugger.removeBreakpoint": Debugger.removeBreakpointParameters;
    "Debugger.restartFrame": Debugger.restartFrameParameters;
    "Debugger.resume": Debugger.resumeParameters;
    "Debugger.searchInContent": Debugger.searchInContentParameters;
    "Debugger.setAsyncCallStackDepth": Debugger.setAsyncCallStackDepthParameters;
    "Debugger.setBlackboxPatterns": Debugger.setBlackboxPatternsParameters;
    "Debugger.setBlackboxedRanges": Debugger.setBlackboxedRangesParameters;
    "Debugger.setBreakpoint": Debugger.setBreakpointParameters;
    "Debugger.setInstrumentationBreakpoint": Debugger.setInstrumentationBreakpointParameters;
    "Debugger.setBreakpointByUrl": Debugger.setBreakpointByUrlParameters;
    "Debugger.setBreakpointOnFunctionCall": Debugger.setBreakpointOnFunctionCallParameters;
    "Debugger.setBreakpointsActive": Debugger.setBreakpointsActiveParameters;
    "Debugger.setPauseOnExceptions": Debugger.setPauseOnExceptionsParameters;
    "Debugger.setReturnValue": Debugger.setReturnValueParameters;
    "Debugger.setScriptSource": Debugger.setScriptSourceParameters;
    "Debugger.setSkipAllPauses": Debugger.setSkipAllPausesParameters;
    "Debugger.setVariableValue": Debugger.setVariableValueParameters;
    "Debugger.stepInto": Debugger.stepIntoParameters;
    "Debugger.stepOut": Debugger.stepOutParameters;
    "Debugger.stepOver": Debugger.stepOverParameters;
    "HeapProfiler.addInspectedHeapObject": HeapProfiler.addInspectedHeapObjectParameters;
    "HeapProfiler.collectGarbage": HeapProfiler.collectGarbageParameters;
    "HeapProfiler.disable": HeapProfiler.disableParameters;
    "HeapProfiler.enable": HeapProfiler.enableParameters;
    "HeapProfiler.getHeapObjectId": HeapProfiler.getHeapObjectIdParameters;
    "HeapProfiler.getObjectByHeapObjectId": HeapProfiler.getObjectByHeapObjectIdParameters;
    "HeapProfiler.getSamplingProfile": HeapProfiler.getSamplingProfileParameters;
    "HeapProfiler.startSampling": HeapProfiler.startSamplingParameters;
    "HeapProfiler.startTrackingHeapObjects": HeapProfiler.startTrackingHeapObjectsParameters;
    "HeapProfiler.stopSampling": HeapProfiler.stopSamplingParameters;
    "HeapProfiler.stopTrackingHeapObjects": HeapProfiler.stopTrackingHeapObjectsParameters;
    "HeapProfiler.takeHeapSnapshot": HeapProfiler.takeHeapSnapshotParameters;
    "Profiler.disable": Profiler.disableParameters;
    "Profiler.enable": Profiler.enableParameters;
    "Profiler.getBestEffortCoverage": Profiler.getBestEffortCoverageParameters;
    "Profiler.setSamplingInterval": Profiler.setSamplingIntervalParameters;
    "Profiler.start": Profiler.startParameters;
    "Profiler.startPreciseCoverage": Profiler.startPreciseCoverageParameters;
    "Profiler.startTypeProfile": Profiler.startTypeProfileParameters;
    "Profiler.stop": Profiler.stopParameters;
    "Profiler.stopPreciseCoverage": Profiler.stopPreciseCoverageParameters;
    "Profiler.stopTypeProfile": Profiler.stopTypeProfileParameters;
    "Profiler.takePreciseCoverage": Profiler.takePreciseCoverageParameters;
    "Profiler.takeTypeProfile": Profiler.takeTypeProfileParameters;
    "Profiler.enableCounters": Profiler.enableCountersParameters;
    "Profiler.disableCounters": Profiler.disableCountersParameters;
    "Profiler.getCounters": Profiler.getCountersParameters;
    "Profiler.enableRuntimeCallStats": Profiler.enableRuntimeCallStatsParameters;
    "Profiler.disableRuntimeCallStats": Profiler.disableRuntimeCallStatsParameters;
    "Profiler.getRuntimeCallStats": Profiler.getRuntimeCallStatsParameters;
    "Runtime.awaitPromise": Runtime.awaitPromiseParameters;
    "Runtime.callFunctionOn": Runtime.callFunctionOnParameters;
    "Runtime.compileScript": Runtime.compileScriptParameters;
    "Runtime.disable": Runtime.disableParameters;
    "Runtime.discardConsoleEntries": Runtime.discardConsoleEntriesParameters;
    "Runtime.enable": Runtime.enableParameters;
    "Runtime.evaluate": Runtime.evaluateParameters;
    "Runtime.getIsolateId": Runtime.getIsolateIdParameters;
    "Runtime.getHeapUsage": Runtime.getHeapUsageParameters;
    "Runtime.getProperties": Runtime.getPropertiesParameters;
    "Runtime.globalLexicalScopeNames": Runtime.globalLexicalScopeNamesParameters;
    "Runtime.queryObjects": Runtime.queryObjectsParameters;
    "Runtime.releaseObject": Runtime.releaseObjectParameters;
    "Runtime.releaseObjectGroup": Runtime.releaseObjectGroupParameters;
    "Runtime.runIfWaitingForDebugger": Runtime.runIfWaitingForDebuggerParameters;
    "Runtime.runScript": Runtime.runScriptParameters;
    "Runtime.setAsyncCallStackDepth": Runtime.setAsyncCallStackDepthParameters;
    "Runtime.setCustomObjectFormatterEnabled": Runtime.setCustomObjectFormatterEnabledParameters;
    "Runtime.setMaxCallStackSizeToCapture": Runtime.setMaxCallStackSizeToCaptureParameters;
    "Runtime.terminateExecution": Runtime.terminateExecutionParameters;
    "Runtime.addBinding": Runtime.addBindingParameters;
    "Runtime.removeBinding": Runtime.removeBindingParameters;
    "Schema.getDomains": Schema.getDomainsParameters;
    "NodeTracing.getCategories": NodeTracing.getCategoriesParameters;
    "NodeTracing.start": NodeTracing.startParameters;
    "NodeTracing.stop": NodeTracing.stopParameters;
    "NodeWorker.sendMessageToWorker": NodeWorker.sendMessageToWorkerParameters;
    "NodeWorker.enable": NodeWorker.enableParameters;
    "NodeWorker.disable": NodeWorker.disableParameters;
    "NodeWorker.detach": NodeWorker.detachParameters;
    "NodeRuntime.notifyWhenWaitingForDisconnect": NodeRuntime.notifyWhenWaitingForDisconnectParameters;
  }
  export interface CommandReturnValues {
    "Console.clearMessages": Console.clearMessagesReturnValue;
    "Console.disable": Console.disableReturnValue;
    "Console.enable": Console.enableReturnValue;
    "Debugger.continueToLocation": Debugger.continueToLocationReturnValue;
    "Debugger.disable": Debugger.disableReturnValue;
    "Debugger.enable": Debugger.enableReturnValue;
    "Debugger.evaluateOnCallFrame": Debugger.evaluateOnCallFrameReturnValue;
    "Debugger.getPossibleBreakpoints": Debugger.getPossibleBreakpointsReturnValue;
    "Debugger.getScriptSource": Debugger.getScriptSourceReturnValue;
    "Debugger.getWasmBytecode": Debugger.getWasmBytecodeReturnValue;
    "Debugger.getStackTrace": Debugger.getStackTraceReturnValue;
    "Debugger.pause": Debugger.pauseReturnValue;
    "Debugger.pauseOnAsyncCall": Debugger.pauseOnAsyncCallReturnValue;
    "Debugger.removeBreakpoint": Debugger.removeBreakpointReturnValue;
    "Debugger.restartFrame": Debugger.restartFrameReturnValue;
    "Debugger.resume": Debugger.resumeReturnValue;
    "Debugger.searchInContent": Debugger.searchInContentReturnValue;
    "Debugger.setAsyncCallStackDepth": Debugger.setAsyncCallStackDepthReturnValue;
    "Debugger.setBlackboxPatterns": Debugger.setBlackboxPatternsReturnValue;
    "Debugger.setBlackboxedRanges": Debugger.setBlackboxedRangesReturnValue;
    "Debugger.setBreakpoint": Debugger.setBreakpointReturnValue;
    "Debugger.setInstrumentationBreakpoint": Debugger.setInstrumentationBreakpointReturnValue;
    "Debugger.setBreakpointByUrl": Debugger.setBreakpointByUrlReturnValue;
    "Debugger.setBreakpointOnFunctionCall": Debugger.setBreakpointOnFunctionCallReturnValue;
    "Debugger.setBreakpointsActive": Debugger.setBreakpointsActiveReturnValue;
    "Debugger.setPauseOnExceptions": Debugger.setPauseOnExceptionsReturnValue;
    "Debugger.setReturnValue": Debugger.setReturnValueReturnValue;
    "Debugger.setScriptSource": Debugger.setScriptSourceReturnValue;
    "Debugger.setSkipAllPauses": Debugger.setSkipAllPausesReturnValue;
    "Debugger.setVariableValue": Debugger.setVariableValueReturnValue;
    "Debugger.stepInto": Debugger.stepIntoReturnValue;
    "Debugger.stepOut": Debugger.stepOutReturnValue;
    "Debugger.stepOver": Debugger.stepOverReturnValue;
    "HeapProfiler.addInspectedHeapObject": HeapProfiler.addInspectedHeapObjectReturnValue;
    "HeapProfiler.collectGarbage": HeapProfiler.collectGarbageReturnValue;
    "HeapProfiler.disable": HeapProfiler.disableReturnValue;
    "HeapProfiler.enable": HeapProfiler.enableReturnValue;
    "HeapProfiler.getHeapObjectId": HeapProfiler.getHeapObjectIdReturnValue;
    "HeapProfiler.getObjectByHeapObjectId": HeapProfiler.getObjectByHeapObjectIdReturnValue;
    "HeapProfiler.getSamplingProfile": HeapProfiler.getSamplingProfileReturnValue;
    "HeapProfiler.startSampling": HeapProfiler.startSamplingReturnValue;
    "HeapProfiler.startTrackingHeapObjects": HeapProfiler.startTrackingHeapObjectsReturnValue;
    "HeapProfiler.stopSampling": HeapProfiler.stopSamplingReturnValue;
    "HeapProfiler.stopTrackingHeapObjects": HeapProfiler.stopTrackingHeapObjectsReturnValue;
    "HeapProfiler.takeHeapSnapshot": HeapProfiler.takeHeapSnapshotReturnValue;
    "Profiler.disable": Profiler.disableReturnValue;
    "Profiler.enable": Profiler.enableReturnValue;
    "Profiler.getBestEffortCoverage": Profiler.getBestEffortCoverageReturnValue;
    "Profiler.setSamplingInterval": Profiler.setSamplingIntervalReturnValue;
    "Profiler.start": Profiler.startReturnValue;
    "Profiler.startPreciseCoverage": Profiler.startPreciseCoverageReturnValue;
    "Profiler.startTypeProfile": Profiler.startTypeProfileReturnValue;
    "Profiler.stop": Profiler.stopReturnValue;
    "Profiler.stopPreciseCoverage": Profiler.stopPreciseCoverageReturnValue;
    "Profiler.stopTypeProfile": Profiler.stopTypeProfileReturnValue;
    "Profiler.takePreciseCoverage": Profiler.takePreciseCoverageReturnValue;
    "Profiler.takeTypeProfile": Profiler.takeTypeProfileReturnValue;
    "Profiler.enableCounters": Profiler.enableCountersReturnValue;
    "Profiler.disableCounters": Profiler.disableCountersReturnValue;
    "Profiler.getCounters": Profiler.getCountersReturnValue;
    "Profiler.enableRuntimeCallStats": Profiler.enableRuntimeCallStatsReturnValue;
    "Profiler.disableRuntimeCallStats": Profiler.disableRuntimeCallStatsReturnValue;
    "Profiler.getRuntimeCallStats": Profiler.getRuntimeCallStatsReturnValue;
    "Runtime.awaitPromise": Runtime.awaitPromiseReturnValue;
    "Runtime.callFunctionOn": Runtime.callFunctionOnReturnValue;
    "Runtime.compileScript": Runtime.compileScriptReturnValue;
    "Runtime.disable": Runtime.disableReturnValue;
    "Runtime.discardConsoleEntries": Runtime.discardConsoleEntriesReturnValue;
    "Runtime.enable": Runtime.enableReturnValue;
    "Runtime.evaluate": Runtime.evaluateReturnValue;
    "Runtime.getIsolateId": Runtime.getIsolateIdReturnValue;
    "Runtime.getHeapUsage": Runtime.getHeapUsageReturnValue;
    "Runtime.getProperties": Runtime.getPropertiesReturnValue;
    "Runtime.globalLexicalScopeNames": Runtime.globalLexicalScopeNamesReturnValue;
    "Runtime.queryObjects": Runtime.queryObjectsReturnValue;
    "Runtime.releaseObject": Runtime.releaseObjectReturnValue;
    "Runtime.releaseObjectGroup": Runtime.releaseObjectGroupReturnValue;
    "Runtime.runIfWaitingForDebugger": Runtime.runIfWaitingForDebuggerReturnValue;
    "Runtime.runScript": Runtime.runScriptReturnValue;
    "Runtime.setAsyncCallStackDepth": Runtime.setAsyncCallStackDepthReturnValue;
    "Runtime.setCustomObjectFormatterEnabled": Runtime.setCustomObjectFormatterEnabledReturnValue;
    "Runtime.setMaxCallStackSizeToCapture": Runtime.setMaxCallStackSizeToCaptureReturnValue;
    "Runtime.terminateExecution": Runtime.terminateExecutionReturnValue;
    "Runtime.addBinding": Runtime.addBindingReturnValue;
    "Runtime.removeBinding": Runtime.removeBindingReturnValue;
    "Schema.getDomains": Schema.getDomainsReturnValue;
    "NodeTracing.getCategories": NodeTracing.getCategoriesReturnValue;
    "NodeTracing.start": NodeTracing.startReturnValue;
    "NodeTracing.stop": NodeTracing.stopReturnValue;
    "NodeWorker.sendMessageToWorker": NodeWorker.sendMessageToWorkerReturnValue;
    "NodeWorker.enable": NodeWorker.enableReturnValue;
    "NodeWorker.disable": NodeWorker.disableReturnValue;
    "NodeWorker.detach": NodeWorker.detachReturnValue;
    "NodeRuntime.notifyWhenWaitingForDisconnect": NodeRuntime.notifyWhenWaitingForDisconnectReturnValue;
  }
}

export interface Connection {
  send<T extends keyof Protocol.CommandParameters>(
    method: T,
    params?: Protocol.CommandParameters[T]
  ): Promise<Protocol.CommandReturnValues[T]>;
  on: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  addListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  off: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  removeListener: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;
  once: <T extends keyof Protocol.Events | symbol>(event: T, listener: (payload: T extends symbol ? any : Protocol.Events[T extends keyof Protocol.Events ? T : never]) => void) => this;

  kill(): void;
}