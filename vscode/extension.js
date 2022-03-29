// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "joel-terminal" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	subscribe(vscode.commands.registerCommand('joel-terminal.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from joel-terminal!');
	}));

	subscribe(vscode.window.registerWebviewViewProvider('joel-terminal.terminal', {
		resolveWebviewView: (webview, cancellation) => {
			webview.webview.cspSource;
			webview.webview.options = {
				enableScripts: true,
				enableForms: true,
				enableCommandUris: true,
			};
			const {PipeTransport} = require('/Users/joeleinbinder/gap-year/protocol/pipeTransport');
			const {spawn} = require('child_process');
			const child = spawn('node', [require.resolve('/Users/joeleinbinder/gap-year/node_host/')], {
				stdio: ['pipe', 'pipe', 'inherit'],
			});
			const pipe = new PipeTransport(child.stdin, child.stdout);
			const cwd = vscode.workspace.rootPath || require('os').homedir();
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
