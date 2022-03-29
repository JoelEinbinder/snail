// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	subscribe(vscode.window.registerWebviewViewProvider('joel-terminal.terminal', {
		resolveWebviewView: (webview, cancellation) => {
			const path = require('path');
			const {spawn} = require('child_process');
			const os = require('os');
			webview.webview.cspSource;
			webview.webview.options = {
				enableScripts: true,
				enableForms: true,
				enableCommandUris: true,
			};
			const {PipeTransport} = require(path.join(os.homedir(), '/gap-year/protocol/pipeTransport'));
			const child = spawn('node', [require.resolve(path.join(os.homedir(), '/gap-year/node_host/'))], {
				stdio: ['pipe', 'pipe', 'inherit'],
			});
			const pipe = new PipeTransport(child.stdin, child.stdout);
			const cwd = vscode.workspace.rootPath || os.homedir();
			webview.webview.html = `
				<!DOCTYPE html>
				<head>
				<base href="http://localhost/gap-year/">
					<script>localStorage.setItem("cwd", ${JSON.stringify(cwd)})</script>
				</head>
				<body>
					<script src="http://localhost/gap-year/main.bundle.js" />
				</body>`;
			webview.webview.onDidReceiveMessage(message => {
				if (message.method === 'beep')
					return;
				pipe.send(message);
			});
			pipe.onmessage = message => {
				webview.webview.postMessage(message);
			};
			webview.onDidDispose(() => {
				child.kill();
			});
		},
	}, {
		webviewOptions: {
			retainContextWhenHidden: true,
		}
	}));

	/**
	 * @param {vscode.Disposable} disposable
	 */
	function subscribe(disposable) {
		context.subscriptions.push(disposable);
	}

}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
