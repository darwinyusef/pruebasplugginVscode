import * as vscode from 'vscode';

export class MyWebviewViewProvider implements vscode.WebviewViewProvider {

	constructor(private readonly extensionUri: vscode.Uri) { }

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true,
		};

		webviewView.webview.html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
		  <meta charset="UTF-8">
		  <title>Sidebar Webview</title>
		  <style>
		  img {
		  	width: 100%; 
			height: auto;
		  }
		  </style>
		</head>
		<body>
		  <img src="https://avatars.githubusercontent.com/u/49506075?v=4" />
		  <h1>Webview Loaded!</h1>
		</body>
		</html>
	  `;
	}
}
