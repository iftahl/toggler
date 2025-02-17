import * as vscode from 'vscode';

let fileCache: Map<string, vscode.Uri[]> = new Map(); // Key: file name, Value: array of URIs

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated!');
    // Initialize the file cache
    initializeFileCache();

    // Listen for changes in workspace folders
    vscode.workspace.onDidChangeWorkspaceFolders(event => {
        console.log('Workspace folders changed:', event);

        // Reinitialize the file cache for new folders
        initializeFileCache();
    });

    // Register the toggle command
    let disposable = vscode.commands.registerCommand('toggler.toggleFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const currentFile = editor.document.fileName;

        // Determine the target file(s) based on the current file's extension
        if (currentFile.endsWith('.cpp')) {
            const headerFile = currentFile.replace(/\.cpp$/, '.h').split('/').pop();
            if (headerFile) openFileByName(headerFile);
        } else if (currentFile.endsWith('.c')) {
            const headerFile = currentFile.replace(/\.c$/, '.h').split('/').pop();
            if (headerFile) openFileByName(headerFile);
        } else if (currentFile.endsWith('.h')) {
            const cppFile = currentFile.replace(/\.h$/, '.cpp').split('/').pop();
            const cFile = currentFile.replace(/\.h$/, '.c').split('/').pop();

            if (cppFile) openFileByName(cppFile);
            if (cFile) openFileByName(cFile);
        } else {
            vscode.window.showErrorMessage('Current file is not a .c, .cpp, or .h file.');
        }
    });

    context.subscriptions.push(disposable);
}

// Initialize the file cache by scanning the workspace
async function initializeFileCache() {
    if (!vscode.workspace.workspaceFolders) {
        return; // No open workspace
    }

    try {
        // Find all .c, .cpp, and .h files in the workspace
        const uris = await vscode.workspace.findFiles('**/*.{c,cpp,h}', '**/node_modules/**');
        fileCache.clear(); // Clear existing cache

        uris.forEach(uri => {
            const fileName = uri.fsPath.split('/').pop(); // Extract just the file name
            if (!fileName) return;

            if (!fileCache.has(fileName)) {
                fileCache.set(fileName, []);
            }
            fileCache.get(fileName)?.push(uri); // Add URI to the array for this file name
        });

        console.log(`Initialized file cache with ${fileCache.size} unique files.`);
        vscode.window.showInformationMessage('Initialized file cache, toggler is ready to use!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize file cache: ${error}`);
    }
}

// Open a file by its name using the smarter cache
function openFileByName(fileName: string) {
    const uris = findInCache(fileName);

    if (uris && uris.length > 0) {
        if (uris.length === 1) {
            // If only one match is found, open it directly
            vscode.workspace.openTextDocument(uris[0]).then(doc => vscode.window.showTextDocument(doc));
            console.log(`Opened: ${uris[0].fsPath}`);
        } else {
            // If multiple matches are found, prompt the user to select one
            const options = uris.map(uri => ({
                label: uri.fsPath,
                uri: uri,
            }));

            vscode.window.showQuickPick(options, { placeHolder: 'Select a file to open' }).then(selection => {
                if (selection) {
                    vscode.workspace.openTextDocument(selection.uri).then(doc => vscode.window.showTextDocument(doc));
                    console.log(`Opened: ${selection.uri.fsPath}`);
                }
            });
        }
    } else {
        // console.log(`File not found in cache: ${fileName}`);
        // vscode.window.showErrorMessage(`File not found: ${fileName}`);
    }
}

// Find a file in the smarter cache by its name
function findInCache(fileName: string): vscode.Uri[] | undefined {
    return fileCache.get(fileName); // Return an array of URIs for this file name
}

// This method is called when your extension is deactivated
export function deactivate() {}
