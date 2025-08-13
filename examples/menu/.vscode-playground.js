import * as vscode from 'vscode';

let statusBarItem;
let registeredCommands = new Map();

export function activate(context) {
    console.log('Playground menu activated!');
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(beaker) Playground';
    statusBarItem.tooltip = 'Click to show playground commands';
    statusBarItem.command = 'playground.showMenu';
    statusBarItem.show();
    
    // Register the menu command
    const showMenuCommand = vscode.commands.registerCommand('playground.showMenu', async () => {
        // Create menu items from registered commands
        const items = Array.from(registeredCommands.entries()).map(([id, info]) => ({
            label: info.title,
            description: info.description,
            command: id
        }));
        
        // Add a separator and utility commands
        items.push(
            { label: '$(add) Register New Command', command: '_registerNew' },
            { label: '$(trash) Clear All Commands', command: '_clearAll' }
        );
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a playground command to run'
        });
        
        if (selected) {
            if (selected.command === '_registerNew') {
                await registerNewCommand();
            } else if (selected.command === '_clearAll') {
                clearAllCommands();
            } else {
                vscode.commands.executeCommand(selected.command);
            }
        }
    });
    
    context.subscriptions.push(showMenuCommand);
    context.subscriptions.push(statusBarItem);
    
    // Helper to register playground commands dynamically
    global.registerPlaygroundCommand = (id, title, handler, description) => {
        // Unregister old command if it exists
        if (registeredCommands.has(id)) {
            const old = registeredCommands.get(id);
            old.disposable.dispose();
        }
        
        // Register the new command
        const disposable = vscode.commands.registerCommand(id, handler);
        registeredCommands.set(id, {
            title,
            description: description || '',
            disposable,
            handler
        });
        
        context.subscriptions.push(disposable);
        
        console.log(`Registered command: ${id} - ${title}`);
        updateStatusBar();
        
        return disposable;
    };
    
    // Register some example commands
    registerPlaygroundCommand(
        'playground.hello',
        '$(megaphone) Say Hello',
        () => vscode.window.showInformationMessage('Hello from Playground!'),
        'Shows a hello message'
    );
    
    registerPlaygroundCommand(
        'playground.currentFile',
        '$(file) Show Current File',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                vscode.window.showInformationMessage(`Current file: ${editor.document.fileName}`);
            }
        },
        'Shows the current file path'
    );
    
    registerPlaygroundCommand(
        'playground.insertText',
        '$(edit) Insert Text at Cursor',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const text = await vscode.window.showInputBox({
                prompt: 'Enter text to insert',
                placeHolder: 'Hello, World!'
            });
            
            if (text) {
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, text);
                });
            }
        },
        'Inserts text at cursor position'
    );
    
    registerPlaygroundCommand(
        'playground.transformSelection',
        '$(symbol-method) Transform Selection',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            
            const selection = editor.selection;
            const text = editor.document.getText(selection);
            
            if (!text) {
                vscode.window.showWarningMessage('No text selected');
                return;
            }
            
            // Example: Convert to uppercase
            editor.edit(editBuilder => {
                editBuilder.replace(selection, text.toUpperCase());
            });
        },
        'Transforms selected text to uppercase'
    );
}

async function registerNewCommand() {
    const id = await vscode.window.showInputBox({
        prompt: 'Enter command ID',
        placeHolder: 'playground.myCommand'
    });
    
    if (!id) return;
    
    const title = await vscode.window.showInputBox({
        prompt: 'Enter command title',
        placeHolder: 'My Command'
    });
    
    if (!title) return;
    
    // For demo, just show a message
    registerPlaygroundCommand(
        id,
        title,
        () => vscode.window.showInformationMessage(`Command ${id} executed!`),
        'User-defined command'
    );
    
    vscode.window.showInformationMessage(`Command '${title}' registered!`);
}

function clearAllCommands() {
    registeredCommands.forEach(cmd => cmd.disposable.dispose());
    registeredCommands.clear();
    updateStatusBar();
    vscode.window.showInformationMessage('All playground commands cleared');
}

function updateStatusBar() {
    const count = registeredCommands.size;
    statusBarItem.text = `$(beaker) Playground (${count})`;
    statusBarItem.tooltip = `${count} playground commands available\nClick to show menu`;
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    registeredCommands.forEach(cmd => cmd.disposable.dispose());
    registeredCommands.clear();
}