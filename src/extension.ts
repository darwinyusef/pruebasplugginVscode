import * as vscode from 'vscode';
// import * as axios from 'axios';
import { MyWebviewViewProvider } from './view/MyWebviewViewProvider';
import dotenv from 'dotenv';

// agrega el .env
dotenv.config();
// Cargar variables de entorno
const apiKeyEnv = process.env.API_KEY_OPENAI;

interface ComentarioDetectado {
	texto: string;
	linea: number;
}

const comentariosDetectados: ComentarioDetectado[] = [];

let apiKey = apiKeyEnv; // pásala luego por env
const contraseniaCorrecta = '123456'; // Cambia esta clave
export function activate(context: vscode.ExtensionContext) {

	console.log('Extension "aquicreamos" is now active!');

	const disposable = vscode.commands.registerCommand('aquicreamos.bienvenida', async () => {

		vscode.window.showInformationMessage(
			'¿Quieres ver el status?',
			'Verlo',
			'No'
		).then(selection => {
			if (selection === 'Verlo') {
				const terminal = vscode.window.createTerminal(`PowerShell`);
				terminal.sendText('git status');
				terminal.show();
			}
		});



		const apiKeyGuardada = context.globalState.get('information') as string;
		if (apiKeyGuardada) {
			vscode.window.showInformationMessage(`API Key guardada: ${apiKeyGuardada}`);
		}
		const contrasenia = await vscode.window.showInputBox({
			prompt: 'Introduce la contraseña para usar la extensión',
			ignoreFocusOut: true,
			password: true
		});

		if (contrasenia !== contraseniaCorrecta) {
			vscode.window.showErrorMessage('Contraseña incorrecta. Acceso denegado.');
			return;
		}

		vscode.window.showInformationMessage('¡Bienvenido a aquicreamos!');
	});

	const disposable2 = vscode.commands.registerCommand('aquicreamos.evaluarCodigo', async () => {
		const editor = vscode.window.activeTextEditor;


		if (!editor) {
			vscode.window.showInformationMessage('No hay archivo abierto.');
			return;
		}

		const filePath = editor.document.uri.fsPath;
		const extension = filePath.split('.').pop();
		const code = editor.document.getText(editor.selection);
		console.log('Código seleccionado:', code);
		async function obtenerDatos() {
			try {
				const url = 'https://gist.githubusercontent.com/darwinyusef/7831d6d3bc435034cd7d5db5ca6c22fb/raw/62f77984fc310e2c121e79150a3c144f79045690/gistfile1.txt';
				const response = await fetch(url);
				const textData = await response.text();
				const data = JSON.parse(textData as string);
				const ejercicio = data.ejercicio1;

				vscode.window.showInformationMessage(`Instrucción recibida: ${ejercicio}`);

				const prompt = `
				Eres un experto en buenas prácticas de programación en ${extension}. Asegúrate de solo escribir código en ${extension}.

				Instrucciones:
				${ejercicio}
				`;

				const response2 = await fetch('https://api.openai.com/v1/chat/completions', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: "gpt-4o-mini",
						messages: [{ role: "user", content: prompt }]
					})
				});

				const textData2 = await response2.text();
				const data2 = JSON.parse(textData2 as string);

				if (!data2.choices || data2.choices.length === 0) {
					throw new Error('No se recibió respuesta válida de OpenAI.');
				}

				return data2.choices[0].message.content;
			} catch (error) {
				console.error('Error:', error);
				vscode.window.showErrorMessage('Ocurrió un error al obtener los datos o consultar GPT.');
			}
		}

		const respuestaGPT = await obtenerDatos();
		if (!respuestaGPT) {
			return;
		}

		editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.end, `\n\n/* Comentarios GPT:\n${respuestaGPT}\n*/`);
		});

		vscode.window.showInformationMessage(`Extensión del archivo: .${extension}`);
	});

	const disposable3 = vscode.commands.registerCommand('aquicreamos.configurar', () => {
		const panel = vscode.window.createWebviewPanel(
			'configuracion', // id interno
			'Configuración App', // título
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		// HTML que se mostrará en la interfaz
		panel.webview.html = getWebviewContent();

		// Recibir mensajes desde el frontend
		panel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'guardarConfig') {
				const apiKey = message.apiKey;
				const password = message.password;

				vscode.window.showInformationMessage(`Guardado! apiKey: ${apiKey} | password: ${password}`);
				// Aquí podrías guardar en settings globales:
				await context.globalState.update('apiKey', apiKey);
				await context.globalState.update('password', password);
			}
		});
	});

	const disposable4 = vscode.window.registerWebviewViewProvider(
		'webviewLeft', new MyWebviewViewProvider(context.extensionUri)
	);

	const disposable5 = vscode.commands.registerCommand('aquicreamos.buscarTodosComentarios', () => {

		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('No hay archivo abierto.');
			return;
		}

		const text = editor.document.getText();

		const lineComments = text.match(/\/\/.*/g) || [];
		const blockComments = text.match(/\/\*[\s\S]*?\*\//g) || [];
		const pyComments = text.match(/#.*/g) || [];

		const allComments = [...lineComments, ...blockComments, ...pyComments];

		console.log('Comentarios encontrados:', allComments);

		if (allComments.length > 0) {
			vscode.window.showInformationMessage(`Se encontraron ${allComments.length} comentarios.`);
		} else {
			vscode.window.showInformationMessage('No se encontraron comentarios.');
		}
	});

	vscode.workspace.onDidChangeTextDocument(event => {
		const changes = event.contentChanges;


		for (const change of changes) {
			const newText = change.text;

			const lineComment = newText.match(/\/\/.*/);
			const blockComment = newText.match(/\/\*[\s\S]*?\*\//);
			const pyComment = newText.match(/#.*/);

			if (lineComment || blockComment || pyComment) {
				const linea = event.document.positionAt(change.rangeOffset).line + 1;  // +1 para que no sea 0-based

				if (lineComment) comentariosDetectados.push({ texto: lineComment[0], linea });
				if (blockComment) comentariosDetectados.push({ texto: blockComment[0], linea });
				if (pyComment) comentariosDetectados.push({ texto: pyComment[0], linea });


				// vscode.window.showInformationMessage(`Comentario detectado en línea ${linea}`);
			}
		}
	});

	const disposable6 = vscode.commands.registerCommand('aquicreamos.buscarComentarios', () => {
		if (comentariosDetectados.length === 0) {
			vscode.window.showInformationMessage('No hay comentarios nuevos.');
			return;
		}

		const items = comentariosDetectados.map(c => `Línea ${c.linea}: ${c.texto}`);

		vscode.window.showQuickPick(items, {
			placeHolder: 'Comentarios detectados recientemente:'
		});
	});



	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
	context.subscriptions.push(disposable3);
	context.subscriptions.push(disposable4);
	context.subscriptions.push(disposable5);
	context.subscriptions.push(disposable6);

	function getWebviewContent() {
		return `
			<html>
			<body>
				<h2>Configuración App</h2>
				<label>API Key:</label><br/>
				<input id="apiKey" style="width: 100%;" /><br/><br/>
				
				<label>Contraseña:</label><br/>
				<input type="password" id="password" style="width: 100%;" /><br/><br/>
	
				<button onclick="guardar()">Guardar</button>
	
				<script>
					const vscode = acquireVsCodeApi();
					function guardar() {
						const apiKey = document.getElementById('apiKey').value;
						const password = document.getElementById('password').value;
						vscode.postMessage({ command: 'guardarConfig', apiKey, password });
					}
				</script>
			</body>
			</html>
		`;
	}
}


export function deactivate() { }
