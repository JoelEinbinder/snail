// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

class ProgressBar {
	constructor() {
	}

	show() {
		if (this.resolve)
			return;
		this.lastProgress = 0;
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: '1d4 Terminal',
			cancellable: false,
		}, (progress, token) => {
			this.progress = progress;
			this.token = token;
			return new Promise((resolve) => {
				this.resolve = resolve;
			});
		});
	}

	hide() {
		if (!this.resolve)
			return;
		this.resolve();
		delete this.resolve;
		delete this.token;
		delete this.progress;
		delete this.lastProgress;
	}

	setProgress(progress) {
		if (progress < 0) {
			this.hide();
			return;
		}
		this.show();
		const increment = 100 * (progress - this.lastProgress);
		this.lastProgress = progress;
		this.progress.report({ increment, message: Intl.NumberFormat(undefined, {
			maximumFractionDigits: 0,
			unit: 'percent',
			style: 'unit',
		}).format(progress * 100) });
	}
}

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
			let ready = false;
			let buffer = [];
			const child = spawn('/usr/local/bin/node', [require.resolve(path.join(os.homedir(), '/gap-year/node_host/'))], {
				env: {},
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
					<script src="http://localhost/gap-year/main.bundle.js"></script>
				</body>`;
			const progressBar = new ProgressBar();
			webview.webview.onDidReceiveMessage(message => {
				if (message.method === 'beep')
					return;
				if (message.method === 'setProgress') {
					progressBar.setProgress(message.params.progress);
					return;
				}
				if (ready)
					pipe.send(message);
				else
					buffer.push(message);
			});
			pipe.onmessage = message => {
				if (message === 'ready') {
					ready = true;
					buffer = [];
					for (const message of buffer)
						pipe.send(message);
					return;	
				}
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
