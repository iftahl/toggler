import * as vscode from 'vscode';

let fileCache: Map<string, { uri: vscode.Uri; directory: string }[]> = new Map(); // Key: file name, Value: array of URIs with directories

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
            const directory = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('/')); // Extract directory path
            if (!fileName) return;

            if (!fileCache.has(fileName)) {
                fileCache.set(fileName, []);
            }
            fileCache.get(fileName)?.push({ uri, directory }); // Add URI and directory to the array for this file name
        });

        console.log(`Initialized file cache with ${fileCache.size} unique files.`);
        vscode.window.showInformationMessage('Initialized file cache, toggler is ready to use!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize file cache: ${error}`);
    }
}

// Open a file by its name using proximity-based selection
function openFileByName(fileName: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const currentFilePath = editor.document.fileName;
    const currentDirectory = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));

    const candidates = findInCache(fileName);
    if (candidates && candidates.length > 0) {
        if (candidates.length === 1) {
            // Only one match, open it directly
            vscode.workspace.openTextDocument(candidates[0].uri).then(doc => vscode.window.showTextDocument(doc));
            console.log(`Opened: ${candidates[0].uri.fsPath}`);
        } else {
            // Find the closest match based on directory proximity
            const closestMatch = findClosestFile(currentDirectory, candidates);

            if (closestMatch) {
                vscode.workspace.openTextDocument(closestMatch.uri).then(doc => vscode.window.showTextDocument(doc));
                console.log(`Opened closest match: ${closestMatch.uri.fsPath}`);
            } else {
                // If no clear match is found, prompt user to select
                const options = candidates.map(candidate => ({
                    label: candidate.uri.fsPath,
                    uri: candidate.uri,
                }));

                vscode.window.showQuickPick(options, { placeHolder: 'Select a file to open' }).then(selection => {
                    if (selection) {
                        vscode.workspace.openTextDocument(selection.uri).then(doc => vscode.window.showTextDocument(doc));
                        console.log(`Opened: ${selection.uri.fsPath}`);
                    }
                });
            }
        }
    } else {
        // console.log(`File not found in cache: ${fileName}`);
        // vscode.window.showErrorMessage(`File not found: ${fileName}`);
    }
}

// Find a file in the smarter cache by its name
function findInCache(fileName: string): { uri: vscode.Uri; directory: string }[] | undefined {
    return fileCache.get(fileName); // Return an array of URIs with directories for this file name
}

// Find the closest matching file based on directory proximity
function findClosestFile(
    currentDirectory: string,
    candidates: { uri: vscode.Uri; directory: string }[]
): { uri: vscode.Uri; directory: string } | undefined {
    let closestMatch: { uri: vscode.Uri; directory: string } | undefined = undefined;
    let shortestDistance = Number.MAX_VALUE;

    candidates.forEach(candidate => {
        const distance = calculateDirectoryDistance(currentDirectory, candidate.directory);
        if (distance < shortestDistance) {
            shortestDistance = distance;
            closestMatch = candidate;
        }
    });

    return closestMatch;
}

// Calculate "distance" between two directories based on unmatched path segments
function calculateDirectoryDistance(dir1: string, dir2: string): number {
    const path1 = dir1.split('/');
    const path2 = dir2.split('/');
    
    let i = 0;
    while (i < path1.length && i < path2.length && path1[i] === path2[i]) {
        i++;
    }

    // Distance is the sum of remaining segments in both paths
    return (path1.length - i) + (path2.length - i);
}

// This method is called when your extension is deactivated
export function deactivate() {}
