import { App, Plugin, TFolder, TFile, Notice } from 'obsidian';
import { PDFDocument } from 'pdf-lib';  // Import pdf-lib for PDF generation

export default class DramaPlugin extends Plugin {
	async onload() {
		// Register the "Convert to Drama Project Folder" command in the command palette and right-click menu
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, folder) => {
				if (folder instanceof TFolder) {
					menu.addItem((item) => {
						item.setTitle("Convert to Drama Project Folder")
							.setIcon("folder")
							.onClick(() => this.createDramaProjectFolder(folder));
					});
				}
			})
		);

		// Right-click "New Scene" in version folder (e.g., v0001)
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, folder) => {
				if (folder instanceof TFolder && folder.name.startsWith('v')) {
					menu.addItem((item) => {
						item.setTitle("New Scene")
							.setIcon("document")
							.onClick(() => this.createNewScene(folder));
					});
				}
			})
		);

		// Right-click "Duplicate to Version Folder" on version folder (e.g., v0001)
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, folder) => {
				if (folder instanceof TFolder && folder.name.startsWith('v')) {
					menu.addItem((item) => {
						item.setTitle("Duplicate to Version Folder")
							.setIcon("documents")
							.onClick(() => this.duplicateVersionFolder(folder));
					});
				}
			})
		);

		// Right-click "Export Manuscript to PDF" on version folder (e.g., v0001)
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, folder) => {
				if (folder instanceof TFolder && folder.name.startsWith('v')) {
					menu.addItem((item) => {
						item.setTitle("Export Manuscript to PDF")
							.setIcon("pdf")
							.onClick(() => this.exportManuscriptToPDF(folder));
					});
				}
			})
		);

		// Register apply style commands for Character, Dialogue, and Stage Directions
		this.addCommand({
			id: 'apply-character-style',
			name: 'Apply Character Style',
			hotkey: [{ modifiers: ["Mod", "Shift"], key: "C" }],
			editorCallback: (editor, view) => {
				let selectedText = editor.getSelection();
				editor.replaceSelection(`**${selectedText.toUpperCase()}**`);
			}
		});

		this.addCommand({
			id: 'apply-dialogue-style',
			name: 'Apply Dialogue Style',
			hotkey: [{ modifiers: ["Mod", "Shift"], key: "D" }],
			editorCallback: (editor, view) => {
				let selectedText = editor.getSelection();
				editor.replaceSelection(selectedText);  // Removes any formatting
			}
		});

		this.addCommand({
			id: 'apply-stage-directions-style',
			name: 'Apply Stage Directions Style',
			hotkey: [{ modifiers: ["Mod", "Shift"], key: "S" }],
			editorCallback: (editor, view) => {
				let selectedText = editor.getSelection();
				editor.replaceSelection(`_${selectedText}_`);
			}
		});
	}

	// Function to create the Drama Project Folder
	async createDramaProjectFolder(folder: TFolder) {
		let versionFolder = await this.app.vault.createFolder(folder.path + '/v0001');
		await this.app.vault.create(versionFolder.path + '/v0001_title_page.md', '# Title Page');
		await this.app.vault.create(versionFolder.path + '/v0001_notes.md', '# Notes');
		await this.app.vault.create(versionFolder.path + '/v0001_scene0001.md', '# Scene 1');
		new Notice('Drama Project Folder Created');
	}

	// Function to create a new scene in a version folder
	async createNewScene(folder: TFolder) {
		let sceneFiles = folder.children.filter(child => child.name.startsWith('v') && child.name.includes('scene'));
		let nextSceneNumber = sceneFiles.length + 1;
		let sceneFileName = `${folder.path}/v${folder.name.substring(1)}_scene${nextSceneNumber.toString().padStart(4, '0')}.md`;
		await this.app.vault.create(sceneFileName, `# Scene ${nextSceneNumber}`);
		new Notice(`Scene ${nextSceneNumber} Created`);
	}

	// Function to duplicate a version folder with all its contents
	async duplicateVersionFolder(folder: TFolder) {
		let versionFolders = folder.parent.children.filter(f => f instanceof TFolder && f.name.startsWith('v'));
		let nextVersionNumber = versionFolders.length + 1;
		let newVersionFolder = await this.app.vault.createFolder(folder.parent.path + `/v${nextVersionNumber.toString().padStart(4, '0')}`);

		for (let file of folder.children) {
			if (file instanceof TFile) {
				let newFileName = file.name.replace(folder.name, newVersionFolder.name);
				let content = await this.app.vault.read(file);
				await this.app.vault.create(newVersionFolder.path + `/${newFileName}`, content);
			}
		}
		new Notice(`Version ${nextVersionNumber} Duplicated`);
	}

	// Function to export all notes in a version folder to a single PDF
	async exportManuscriptToPDF(folder: TFolder) {
		let pdfDoc = await PDFDocument.create();

		for (let file of folder.children) {
			if (file instanceof TFile) {
				let content = await this.app.vault.read(file);
				let page = pdfDoc.addPage();
				page.drawText(content);
			}
		}

		let pdfBytes = await pdfDoc.save();
		let blob = new Blob([pdfBytes], { type: "application/pdf" });
		let link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = `${folder.name}.pdf`;
		link.click();
		new Notice('Manuscript Exported to PDF');
	}
}
