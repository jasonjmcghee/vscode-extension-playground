// VS Code Musical Notes Play Button Extension

// Note: Playing the notes won't work on your system
// But you can swap out what happens when you click it.

import * as vscode from 'vscode';

console.log('Musical notes playground activated!');

let currentInstrument = 108; // Kalimba
let currentTempo = 120;

const codeLensPatterns = {
    // Pattern for INSTRUMENT=<number>
    instrument: {
        pattern: /\bINSTRUMENT=(\d+)\b/g,
        title: (matches) => `Set Instrument (${currentInstrument}) to ${matches[1]}`,
        command: 'musicNotes.setInstrument',
        handler: async (matches) => {
            const instrument = parseInt(matches[1]);
            currentInstrument = instrument
            return instrument;
        }
    },
    
    // Pattern for TEMPO=<number>
    tempo: {
        pattern: /\bTEMPO=(\d+)\b/g,
        title: (matches) => `Set Tempo (${currentTempo}) to ${matches[1]} BPM`,
        command: 'musicNotes.setTempo',
        handler: async (matches) => {
            const tempo = parseInt(matches[1]);
            currentTempo = tempo
            return tempo;
        }
    },
    
    // Pattern for complex chord groups with parentheses
    chordGroups: {
        pattern: /\([^)]*[A-G][#b]?[0-9][^)]*\)/,
        fullLineExtractor: (line) => {
            const noteExprPattern = /[-•]\s*(.*?)(?:\s+—|\s*$)/;
            const noteMatch = line.match(noteExprPattern);
            if (noteMatch) {
                const fullExpression = noteMatch[1].trim();
                const validNotePattern = /[A-G][#b]?[0-9]/;
                if (validNotePattern.test(fullExpression)) {
                    return {
                        expression: fullExpression,
                        startIdx: line.indexOf(fullExpression)
                    };
                }
            }
            return null;
        },
        multipleCommands: true,
        commands: [
            {
                title: `▶ Play Chord`,
                command: 'musicNotes.playChord',
                handler: async (notes) => {
                    await playNotes(notes, 0.02);
                    vscode.window.setStatusBarMessage(`♪ Playing Chord: ${notes.join(' ')}`, 2000);
                }
            },
            {
                title: `▶ Play Sequence`,
                command: 'musicNotes.playSequence',
                condition: (notes) => notes.length > 1,
                handler: async (notes) => {
                    await playNotes(notes, 0.5);
                    vscode.window.setStatusBarMessage(`♪ Playing Sequence: ${notes.join(' → ')}`, 2000);
                }
            }
        ]
    },
    
    // Pattern for simple note sequences
    noteSequence: {
        pattern: /\b((?:[A-G][#b]?\d\s+)+[A-G][#b]?\d)\b/g,
        processor: (match) => match[1].trim().split(/\s+/),
        multipleCommands: true,
        commands: [
            {
                title: `▶ Play Chord`,
                command: 'musicNotes.playChord',
                handler: async (noteArray) => {
                    await playNotes(noteArray, 0.02);
                    vscode.window.setStatusBarMessage(`♪ Playing Chord: ${noteArray.join(' ')}`, 2000);
                }
            },
            {
                title: `▶ Play Sequence`,
                command: 'musicNotes.playSequence',
                condition: (noteArray) => noteArray.length > 1,
                handler: async (noteArray) => {
                    await playNotes(noteArray, 0.5);
                    vscode.window.setStatusBarMessage(`♪ Playing Sequence: ${noteArray.join(' → ')}`, 2000);
                }
            }
        ]
    },
    
    // Pattern for single notes
    singleNote: {
        pattern: /\b([A-G][#b]?\d)\b/g,
        skipIfProcessed: true,  // Skip if already handled by another pattern
        title: `▶ Play`,
        command: 'musicNotes.playChord',
        handler: async (note) => {
            await playNotes([note[1]], 0.02);
            vscode.window.setStatusBarMessage(`♪ Playing: ${note[1]}`, 2000);
        }
    }
};

// Generic CodeLens provider that uses the configuration
class ConfigurableCodeLensProvider {
    constructor() {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        this.registeredCommands = new Map();
        this.registerCommands();
    }
    
    registerCommands() {
        // Register all commands from the configuration
        for (const [key, config] of Object.entries(codeLensPatterns)) {
            if (config.multipleCommands && config.commands) {
                // Register multiple commands for this pattern
                for (const cmd of config.commands) {
                    if (!this.registeredCommands.has(cmd.command)) {
                        const disposable = vscode.commands.registerCommand(cmd.command, cmd.handler);
                        this.registeredCommands.set(cmd.command, disposable);
                    }
                }
            } else if (config.command && config.handler) {
                // Register single command
                if (!this.registeredCommands.has(config.command)) {
                    const disposable = vscode.commands.registerCommand(config.command, config.handler);
                    this.registeredCommands.set(config.command, disposable);
                }
            }
        }
    }
    
    provideCodeLenses(document, token) {
        const codeLenses = [];
        
        // Only process markdown files
        if (document.languageId !== 'markdown') {
            return codeLenses;
        }
        
        const text = document.getText();
        const lines = text.split('\n');
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            
            // Track if this line was processed by a full line extractor
            let lineProcessed = false;
            
            // Process each pattern type
            for (const [key, config] of Object.entries(codeLensPatterns)) {
                // Handle full line extractors (like chord groups)
                if (config.fullLineExtractor && !lineProcessed) {
                    const extracted = config.fullLineExtractor(line);
                    if (extracted) {
                        const startPos = new vscode.Position(lineNum, extracted.startIdx);
                        const endPos = new vscode.Position(lineNum, extracted.startIdx + extracted.expression.length);
                        const range = new vscode.Range(startPos, endPos);
                        
                        const notes = extracted.expression.split(/\s+/);
                        
                        if (config.multipleCommands && config.commands) {
                            for (const cmd of config.commands) {
                                if (!cmd.condition || cmd.condition(notes)) {
                                    const command = {
                                        title: typeof cmd.title === 'function' ? cmd.title(notes) : cmd.title,
                                        command: cmd.command,
                                        arguments: [notes]
                                    };
                                    codeLenses.push(new vscode.CodeLens(range, command));
                                }
                            }
                        }
                        lineProcessed = true;
                        continue;
                    }
                }
                
                // Skip regular pattern matching if line was already processed
                if (lineProcessed) {
                    continue;
                }
                
                // Handle regular pattern matching
                if (config.pattern) {
                    // Reset the pattern if it's global
                    if (config.pattern.global) {
                        config.pattern.lastIndex = 0;
                    }
                    
                    let match;
                    const pattern = config.pattern.global ? config.pattern : new RegExp(config.pattern.source, 'g');
                    
                    while ((match = pattern.exec(line)) !== null) {
                        // Skip if this should be skipped when already processed
                        if (config.skipIfProcessed) {
                            let isProcessed = false;
                            for (const lens of codeLenses) {
                                if (lens.range.contains(new vscode.Position(lineNum, match.index))) {
                                    isProcessed = true;
                                    break;
                                }
                            }
                            if (isProcessed) continue;
                        }
                        
                        const startPos = new vscode.Position(lineNum, match.index);
                        const endPos = new vscode.Position(lineNum, match.index + match[0].length);
                        const range = new vscode.Range(startPos, endPos);
                        
                        // Process the match if needed
                        const processedMatch = config.processor ? config.processor(match) : match;
                        
                        if (config.multipleCommands && config.commands) {
                            for (const cmd of config.commands) {
                                if (!cmd.condition || cmd.condition(processedMatch)) {
                                    const command = {
                                        title: typeof cmd.title === 'function' ? cmd.title(processedMatch) : cmd.title,
                                        command: cmd.command,
                                        arguments: [processedMatch]
                                    };
                                    codeLenses.push(new vscode.CodeLens(range, command));
                                }
                            }
                        } else {
                            const command = {
                                title: typeof config.title === 'function' ? config.title(match) : config.title,
                                command: config.command,
                                arguments: [match]
                            };
                            codeLenses.push(new vscode.CodeLens(range, command));
                        }
                    }
                }
            }
        }
        
        return codeLenses;
    }
    
    dispose() {
        for (const disposable of this.registeredCommands.values()) {
            disposable.dispose();
        }
        this.registeredCommands.clear();
    }
}

// Register the CodeLens provider
const codeLensProvider = new ConfigurableCodeLensProvider();
const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { language: 'markdown' },
    codeLensProvider
);

// Helper function to play notes with specified stagger (in beats)
function playNotes(notes, staggerBeats = 0) {
    if (!notes || notes.length === 0) {
        return Promise.reject('No notes provided');
    }
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return Promise.reject('No workspace folder');
    }
    
    vscode.window.showInformationMessage(`You played ${notes.join(" ")}`);
}

// Add handlers for the new pattern-based commands
codeLensPatterns.instrument.handler = async (matches) => {
    currentInstrument = parseInt(matches[1]);
    vscode.window.showInformationMessage(`Instrument set to: ${currentInstrument}`);
    return currentInstrument;
};

codeLensPatterns.tempo.handler = async (matches) => {
    currentTempo = parseInt(matches[1]);
    vscode.window.showInformationMessage(`Tempo set to: ${currentTempo} BPM`);
    return currentTempo;
};

// Add a status bar item to show the extension is active
const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusBarItem.text = '$(music) Notes Active';
statusBarItem.tooltip = 'Click musical notes in markdown files to play them';
statusBarItem.show();

// Also add inline decorations to highlight notes
const noteDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    border: '1px solid rgba(100, 200, 255, 0.3)',
    borderRadius: '3px',
    cursor: 'pointer'
});

// Regular expression to match musical notes for decorations
const notePattern = /\b([A-G][#b]?\d)\b/g;

// Function to update decorations
function updateDecorations() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
        return;
    }
    
    const text = activeEditor.document.getText();
    const decorations = [];
    let match;
    
    // Reset the pattern
    notePattern.lastIndex = 0;
    
    while ((match = notePattern.exec(text)) !== null) {
        const startPos = activeEditor.document.positionAt(match.index);
        const endPos = activeEditor.document.positionAt(match.index + match[0].length);
        const decoration = { range: new vscode.Range(startPos, endPos) };
        decorations.push(decoration);
    }
    
    activeEditor.setDecorations(noteDecorationType, decorations);
}

// Update decorations when the active editor changes
vscode.window.onDidChangeActiveTextEditor(updateDecorations);

// Update decorations when the document changes
vscode.workspace.onDidChangeTextDocument(event => {
    if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
        updateDecorations();
    }
});

// Initial update
updateDecorations();

// Export cleanup function
export function deactivate() {
    console.log('Deactivating music notes extension...');
    
    // Dispose of all resources
    if (statusBarItem) statusBarItem.dispose();
    if (codeLensDisposable) codeLensDisposable.dispose();
    if (codeLensProvider) codeLensProvider.dispose();
    if (noteDecorationType) noteDecorationType.dispose();
}