import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PlaygroundExecutor } from './playground.js';

let playgroundExecutor: PlaygroundExecutor | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('VS Code Runtime Playground is now active!');
    
    const outputChannel = vscode.window.createOutputChannel('VS Code Playground');
    playgroundExecutor = new PlaygroundExecutor(context, outputChannel);
    
    const createPlaygroundFile = vscode.commands.registerCommand('vscode-playground.createPlaygroundFile', () => {
        createInitialPlaygroundFile();
    });
    
    const runPlayground = vscode.commands.registerCommand('vscode-playground.runPlayground', () => {
        if (playgroundExecutor) {
            executePlaygroundFile(playgroundExecutor);
        }
    });
    
    const stopPlayground = vscode.commands.registerCommand('vscode-playground.stopPlayground', () => {
        if (playgroundExecutor) {
            playgroundExecutor.stop();
            vscode.window.showInformationMessage('Playground stopped');
        }
    });
    
    context.subscriptions.push(createPlaygroundFile, runPlayground, stopPlayground, outputChannel);
    
    const config = vscode.workspace.getConfiguration('vscode-playground');
    const autoRun = config.get<boolean>('autoRun', true);
    
    if (autoRun) {
        setupFileWatcher(context, playgroundExecutor);
    }
    
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(play) Playground Ready';
    statusBarItem.tooltip = 'VS Code Runtime Playground';
    statusBarItem.command = 'vscode-playground.runPlayground';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    if (vscode.workspace.workspaceFolders) {
        const playgroundPath = getPlaygroundFilePath();
        if (fs.existsSync(playgroundPath) && autoRun) {
            executePlaygroundFile(playgroundExecutor);
        }
    }
}

export function deactivate() {
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (playgroundExecutor) {
        playgroundExecutor.stop();
    }
}

function setupFileWatcher(context: vscode.ExtensionContext, executor: PlaygroundExecutor) {
    if (!vscode.workspace.workspaceFolders) {
        return;
    }
    
    const config = vscode.workspace.getConfiguration('vscode-playground');
    const playgroundFileName = config.get<string>('playgroundFileName', '.vscode-playground.js');
    const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], playgroundFileName);
    
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    
    fileWatcher.onDidChange(() => {
        console.log('Playground file changed, reloading...');
        executePlaygroundFile(executor);
    });
    
    fileWatcher.onDidCreate(() => {
        console.log('Playground file created, executing...');
        executePlaygroundFile(executor);
    });
    
    context.subscriptions.push(fileWatcher);
}

function getPlaygroundFilePath(): string {
    const config = vscode.workspace.getConfiguration('vscode-playground');
    const playgroundFileName = config.get<string>('playgroundFileName', '.vscode-playground.js');
    
    if (vscode.workspace.workspaceFolders) {
        return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, playgroundFileName);
    }
    
    return '';
}

async function executePlaygroundFile(executor: PlaygroundExecutor) {
    const playgroundPath = getPlaygroundFilePath();
    
    if (!playgroundPath || !fs.existsSync(playgroundPath)) {
        vscode.window.showWarningMessage('Playground file not found. Create one with "Create VS Code Playground File" command.');
        return;
    }
    
    try {
        await executor.execute(playgroundPath);
    } catch (error) {
        vscode.window.showErrorMessage(`Playground execution failed: ${error}`);
    }
}

function createInitialPlaygroundFile() {
    const playgroundPath = getPlaygroundFilePath();
    
    if (!playgroundPath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    
    if (fs.existsSync(playgroundPath)) {
        vscode.window.showWarningMessage('Playground file already exists');
        return;
    }
    
    const template = `// VS Code Runtime Playground - ESM Syntax
// This file has full access to the VS Code API
// Save this file to execute it automatically

import * as vscode from 'vscode';

// Example: Show an information message
vscode.window.showInformationMessage('Hello from VS Code Playground! 🎉');

// Example: Create a status bar item
const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
statusItem.text = '$(rocket) Playground Active';
statusItem.show();

// Example: Register a command
const disposable = vscode.commands.registerCommand('playground.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Playground!');
});

// Example: Work with the active editor
const editor = vscode.window.activeTextEditor;
if (editor) {
    const doc = editor.document;
    console.log(\`Current file: \${doc.fileName}\`);
    console.log(\`Language: \${doc.languageId}\`);
    console.log(\`Lines: \${doc.lineCount}\`);
}

// Example: Access workspace configuration
const config = vscode.workspace.getConfiguration();
const theme = config.get('workbench.colorTheme');
console.log(\`Current theme: \${theme}\`);

// Example: Work with workspace folders
if (vscode.workspace.workspaceFolders) {
    console.log('Workspace folders:');
    vscode.workspace.workspaceFolders.forEach(folder => {
        console.log(\`  - \${folder.name}: \${folder.uri.fsPath}\`);
    });
}

// Example: Create a QuickPick
export async function showQuickPick() {
    const items = ['Option 1', 'Option 2', 'Option 3'];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an option'
    });
    if (selected) {
        vscode.window.showInformationMessage(\`You selected: \${selected}\`);
    }
}

// Example: Export a function that can be called
export function customAction() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        vscode.window.showInformationMessage(\`Selected text: "\${text}"\`);
    }
}

// Cleanup function (optional)
export function deactivate() {
    statusItem.dispose();
    disposable.dispose();
}

console.log('Playground loaded successfully! Check the VS Code Playground output channel for logs.');
`;
    
    fs.writeFileSync(playgroundPath, template);
    
    vscode.workspace.openTextDocument(playgroundPath).then(doc => {
        vscode.window.showTextDocument(doc);
    });
}