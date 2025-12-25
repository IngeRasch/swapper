//This module's ID, used throughout the module
const MODULE_ID = "swapper";

//"Import" ApplicationV2 and HandlebarsApplicationMixin from Foundry via destructuring.
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;


//****************************************************************************************************
//****************************************************************************************************
//
// Define the ApplicationV2 class to handle the User Interface
//
//****************************************************************************************************
//****************************************************************************************************
//Define an ApplicationV2 class for configuring rotation file suffix settings.
class RotationFilesuffixConfig extends HandlebarsApplicationMixin(ApplicationV2) {
	//Variable holding the current rotationFilesuffixMatrix.
	rotationFilesuffixMatrix = [];
	static DEFAULT_OPTIONS = {
		//CSS classes applied to the window.
		classes: ["application", "form"],
		//Tell ApplicationV2 this is a form.
		tag: "form",
		form: {
			handler: RotationFilesuffixConfig.handleForm,
			submitOnChange: false,
			closeOnSubmit: false
		},
		//The actions object is a record of functions automatically bound as click listeners to elements 
		//with matching data-action attributes. These should be static functions, but their 'this' will 
		//still refer to the class instance.
		actions: {
			addRow: RotationFilesuffixConfig.addRow,
			removeRow: RotationFilesuffixConfig.removeRow,
			resetDefaults: RotationFilesuffixConfig.resetDefaults
		},
		window: {
			//title: "swapper.GameSettings.rotationFilesuffixMatrixMenu.Name",
			icon: "fas fa-table",
			size: { width: 500, height: "auto" },
			minSize: { width: 300, height: 200 },
			resizable: true,
			controls: []
		}
	};
	// Override the title getter
	get title() {
		if (this.scope === "token" && this.document) {
			return game.i18n.localize("swapper.TokenConfig.LocalRotationFilesuffixMatrix.ApplicationName") + ` (${this.document.name})`;
		}
		return game.i18n.localize("swapper.GameSettings.rotationFilesuffixMatrixMenu.Name");
	}
	
	//HandlebarsApplication uses the static PARTS property to define template parts.
	static PARTS = {
		form: {
			//@property {string} template: The template entry point for the part.
			template: "modules/swapper/templates/rotation-filesuffix.hbs"
		}
	};
	
	//Set up a constructor function, so this menu can be called from anywhere, not just the game settings.
	//The options here will let us define where the call is comming from.
	//No options means it's the Configure Settings (and will be refered to as "global").
	constructor(options={}) {
		super(options);
		this.document = options.document ?? null;   // token document if local
		this.scope = options.scope ?? "global";     // "global" or "token"
	}
	
	//Return the context accessible to the template.
	async _prepareContext(options) {
		//If we already have a local working copy of rotationFilesuffixMatrix, keep using it.
		if (this.rotationFilesuffixMatrix?.length > 0) {
			return { rotationFilesuffixMatrix: this.rotationFilesuffixMatrix };
		}
		//Otherwise initialize (the instanced class variable) rotationFilesuffixMatrix based on the scope
		//where this Application is called from (global config or token specific).
		if (this.scope === "token" && this.document) {
			//If the scope is token, get the token specific localRotationFilesuffixMatrix.
			this.rotationFilesuffixMatrix = this.document.getFlag(MODULE_ID, "localRotationFilesuffixMatrix") ?? [];
		} else {
			//If the scope is global, get the rotationFilesuffixMatrix from the world's game settings.
			this.rotationFilesuffixMatrix = game.settings.get(MODULE_ID, "rotationFilesuffixMatrix");
		}
		return { rotationFilesuffixMatrix: this.rotationFilesuffixMatrix };
	};
	
	// Form submission handler (when "Save" is pressed).
	static async handleForm(event, form, formData) {
		//Stop native form submission.
		event.preventDefault();
		//Grab the normalized object from FormDataExtended, which looks like:
		//{ rotation: [ "0", "45", "90", ... ], filesuffix: [ "S", "SW", "W", ... ] }
		const obj = formData.object;
		const updatedMatrix = [];
		//Make sure both arrays exist.
		const rotations = obj.rotation || [];
		const suffixes = obj.filesuffix || [];
		//Iterate over the form data, and create an updated matrix.
		for (let i = 0; i < rotations.length; i++) {
			let rotation = Number(rotations[i]);
			// Normalize into 0–359 degrees.
			//rotation = ((rotation % 360) + 360) % 360;
			if (rotation < 0 || rotation >= 360) {
				const normalized = ((rotation % 360) + 360) % 360;
				//Warning 001: rotation was normalized between 0 and 360 degrees.
				ui.notifications.warn(game.i18n.format("swapper.Warnings.Warning001", { old: rotation, new: normalized }));
				rotation = normalized;
			}
			const filesuffix = (suffixes[i] ?? "").trim();
			if (isNaN(rotation) || rotation < 0 || rotation > 360) {
				//Error 001: The rotation must be a number representing a rotation between 0 and 360.
				ui.notifications.error(game.i18n.localize("swapper.Errors.Error001"));
				//Abort the save.
				return;
			}
			updatedMatrix.push({ rotation, filesuffix });
		}
		//Validate that there are no duplicate rotations.
		const seen = new Set();
		//The Array.some() function will return true if it finds a duplicate.
		const duplicates = updatedMatrix.some(entry => {
			if (seen.has(entry.rotation)) return true;
			seen.add(entry.rotation);
			return false;
		});
		if (duplicates) {
			//Error 002: There can be no duplicate rotations.
			ui.notifications.error(game.i18n.localize("swapper.Errors.Error002"));
			//Abort the save.
			return;
		}
		//Sort the updated matrix by rotation for readability.
		updatedMatrix.sort((a, b) => a.rotation - b.rotation);
		// Update local class copy of rotationFilesuffixMatrix.
		this.rotationFilesuffixMatrix = updatedMatrix;
		
		//Make persistent by updating token or game settings.
		if (this.scope === "token" && this.document) {
			await this.document.setFlag(MODULE_ID, "localRotationFilesuffixMatrix", updatedMatrix);
		} else {
			await game.settings.set(MODULE_ID, "rotationFilesuffixMatrix", updatedMatrix);
		}
		// Re-render UI window with the updated matrix.
		this.render();
	};
	
	//Actions defined in class DEFAULT_OPTIONS and usable as data-actions by the HTML code in the template.
	static addRow(event, target) {
		// Add a blank row with 0 degrees and a blank file suffix.
		this.rotationFilesuffixMatrix.push({rotation: 0, filesuffix: ""});
		// Re-render the window so the new row appears.
		this.render();
	};
	
	static removeRow(event, target) {
		//Find the row element that contains the clicked button.
		const row = target.closest("tr");
		if (!row) return;
		//Get the index of the row within the tbody.
		const tbody = row.parentElement;
		const index = Array.from(tbody.children).indexOf(row);
		//Remove that entry from the local matrix.
		if (index >= 0) {
			this.rotationFilesuffixMatrix.splice(index, 1);
		}
		//Re-render the window so the updated matrix is shown.
		this.render();
	};
	
	static resetDefaults(event, target) {
		//Get the default rotationFilesuffixMatrix value from the world's game settings.
		const defaults = game.settings.settings.get("swapper.rotationFilesuffixMatrix").default;
		//Replace (the instanced class variable) rotationFilesuffixMatrix.
		this.rotationFilesuffixMatrix = foundry.utils.deepClone(defaults);
		//Re-render the window so the defaults appear.
		this.render();
	};
};




//****************************************************************************************************
//****************************************************************************************************
//
//Register module settings, accessible under Game Settings -> Configure Settings
//
//****************************************************************************************************
//****************************************************************************************************
//Register settings and menu in a single init hook.
Hooks.once("init", function() {
	game.settings.register(MODULE_ID, "globalSwappingEnabled", {
		name: "swapper.GameSettings.globalSwappingEnabled.Name",
		hint: "swapper.GameSettings.globalSwappingEnabled.Hint",
		scope: "world",
		//Expose directly in the game settings menu.
		config: true,
		type: Boolean,
		default: true
	});
	game.settings.register(MODULE_ID, "rotationFilesuffixMatrix", {
		name: "swapper.GameSettings.rotationFilesuffixMatrix.Name",
		hint: "swapper.GameSettings.rotationFilesuffixMatrix.Hint",
		scope: "world",
		//Do not expose the setting directly; ApplicationV2 will be used instead.
		config: false,
		type: Array,
		default: [
			{rotation: 0,   filesuffix: "S"},
			{rotation: 45,  filesuffix: "SW"},
			{rotation: 90,  filesuffix: "W"},
			{rotation: 135, filesuffix: "NW"},
			{rotation: 180, filesuffix: "N"},
			{rotation: 225, filesuffix: "NE"},
			{rotation: 270, filesuffix: "E"},
			{rotation: 315, filesuffix: "SE"}
		]
	});
	game.settings.registerMenu(MODULE_ID, "rotationFilesuffixMatrixMenu", {
		name: "swapper.GameSettings.rotationFilesuffixMatrixMenu.Name",
		label: "swapper.GameSettings.rotationFilesuffixMatrixMenu.Label",
		hint: "swapper.GameSettings.rotationFilesuffixMatrixMenu.Hint",
		icon: "fas fa-table",
		type: RotationFilesuffixConfig,
		restricted: true
	});
});




//****************************************************************************************************
//****************************************************************************************************
//
//Hooks into FoundryVTT events to inject module functionality.
//
//****************************************************************************************************
//****************************************************************************************************
//Hooks into FoundryVTT event preUpdateToken.
Hooks.on("preUpdateToken", function(tokenDocument, changes) {
	//Return if this token should not use image swapping on rotation
	if (!imageSwappingSettingsForThisToken(tokenDocument)) return;
	//Get the token object from the document ID.
	const token = canvas.tokens.get(tokenDocument.id);
	//Check for changes in the token rotation.
	//If there is a change in rotation, update the texture reference in the token document.
	//This will not automatically re-render the mesh, but since loadTex() is asynchronous,
	//mesh updates will be handled in the hook for "updateToken".
	if (changes.rotation !== null && changes.rotation !== undefined && changes.rotation !== token.document.rotation) {
		//If the rotation is being updated, normalize it between 0 and 360 degrees.
		let newRotation = ((changes.rotation % 360) + 360) % 360;
		//Find the closest target rotation (with a texture).
		let closestTarget = returnClosestRotation(tokenDocument, newRotation);
		//If no closest target exist, show a warning to the user and return.
		if (!closestTarget) return;
		//Get current token texture.
		let texture = tokenDocument.texture.src;
		//If the texture path does not have an underscore to tell the module where the file suffix should
		//be appended, we should return the function and not perform the update.
		if (texture.lastIndexOf("_") == -1) {
			//If the texture has no underscore, return and warn the user.
			ui.notifications.warn(game.i18n.localize("swapper.Warnings.Warning004"));
			return;
		}
		//Get the file extension (i.e. .jpg, .webp, etc.).
		let textureFileExtension = texture.substring(texture.lastIndexOf("."), texture.length);
		//Create updated texture reference, based on target rotation file suffix and adding file extension.
		let newTexture = texture.substring(0, texture.lastIndexOf("_")) + "_" + closestTarget.filesuffix + textureFileExtension;
		//If there is a change in texture...
		if (texture !== newTexture) {
			//Add the new texture to the changes in this preUpdate.
			changes.texture = { src: newTexture };
			//Note: we can't change the mesh here using "await foundry.canvas.loadTexture(newTexture);"
			//because preUpdateToken is a synchronous function and await loadTexture is asynchronous.
			//We use the hook updateToken to change the mesh.
		}
	}
});


//Hooks into FoundryVTT event UpdateToken.
Hooks.on("updateToken", async function(tokenDocument, changes) {
	//Return if this token should not use image swapping on rotation
	if (!imageSwappingSettingsForThisToken(tokenDocument)) return;
	const token = canvas.tokens.get(tokenDocument.id);
	//Only act if texture was changed (in preUpdateToken or other source).
	if (changes.texture?.src) {
		//Get the texture using a version‑aware loader (v13+ vs v12 fallback).
		const loadTex = foundry?.canvas?.loadTexture ?? globalThis.loadTexture;
		//Load the texture. If the asset is invalid, FoundryVTT logs an error and this returns null.
		const tex = await loadTex(changes.texture.src);
		//Check if a texture could be loaded.
		if (!tex){
			//If not, show a warning to the user and return.
			ui.notifications.warn(game.i18n.format("swapper.Warnings.Warning002", { texture: changes.texture.src }));
			return;
		}
		//If a texture was loaded, update the mesh immediately.
		if (tex && token?.mesh) {
			//Change texture directly.
			token.mesh.texture = tex;
			//Set mesh alpha (in case a fade animation is running).
			token.alpha = 1;
			//Refresh token.
			token.refresh();
		}
	}
});


//Hooks into FoundryVTT event renderTokenConfig.
Hooks.on("renderTokenConfig", function(app, html, context, options) {
	//Create a FormGroup for the token specific settings, and
	//wrap the HTML element inside a fieldset elemet.
	//This will create a box around this module's settings inside Token Configuration.
	//First a formGroup for setting the document flag: overrideGlobalSettings
	const overrideGlobalSettingsGroup = foundry.applications.fields.createFormGroup({
		input: foundry.applications.fields.createCheckboxInput({
			name: `flags.${MODULE_ID}.overrideGlobalSettings`,
			value: context.document.getFlag(MODULE_ID, "overrideGlobalSettings") ?? true
		}),
		label: `${MODULE_ID}.TokenConfig.OverrideGlobalSettings.Label`,
		hint: `${MODULE_ID}.TokenConfig.OverrideGlobalSettings.Hint`,
		localize: true
	});
	//Then a formGroup for setting the document flag: localSwappingEnabled
	const localSwappingEnabledGroup = foundry.applications.fields.createFormGroup({
		input: foundry.applications.fields.createCheckboxInput({
			name: `flags.${MODULE_ID}.localSwappingEnabled`,
			value: context.document.getFlag(MODULE_ID, "localSwappingEnabled") ?? true
		}),
		label: `${MODULE_ID}.TokenConfig.LocalSwappingEnabled.Label`,
		hint: `${MODULE_ID}.TokenConfig.LocalSwappingEnabled.Hint`,
		localize: true
	});
	// Create a form group for the "Configure Local Matrix" button
	const LocalRotationFilesuffixMatrixGroup = foundry.applications.fields.createFormGroup({
		input: (() => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.innerHTML = `<i class="fas fa-table" inert=""></i>  ${game.i18n.localize(`${MODULE_ID}.TokenConfig.LocalRotationFilesuffixMatrix.ButtonLabel`)}`;
			btn.addEventListener("click", ev => {
				ev.preventDefault();
				new RotationFilesuffixConfig({
					document: app.document,
					scope: "token"
				}).render(true);
			});
		return btn;
	})(),
	label: `${MODULE_ID}.TokenConfig.LocalRotationFilesuffixMatrix.Label`,
	hint: `${MODULE_ID}.TokenConfig.LocalRotationFilesuffixMatrix.Hint`,
	localize: true
	});
	// Wrap them in a fieldset element in HTML.
	const fieldset = document.createElement("fieldset");
	const fieldsetlegend = document.createElement("legend");
	fieldsetlegend.textContent = game.i18n.localize(`${MODULE_ID}.TokenConfig.Fieldset.Legend`);
	fieldset.appendChild(fieldsetlegend);
	fieldset.appendChild(overrideGlobalSettingsGroup);
	fieldset.appendChild(localSwappingEnabledGroup);
	fieldset.appendChild(LocalRotationFilesuffixMatrixGroup);
	//Use querySelector to find the HTML element holding the Apperance tab, in Toknen Configuration. 
	const appearanceTab = html.querySelector('.tab[data-group="sheet"][data-tab="appearance"]');
	//Append the new HTML elements as the last element inside the Apperance tab.
	if (appearanceTab) {
		appearanceTab.append(fieldset);
		// Mutating the DOM can result in an app overflowing rather than growing.
		// A call to setPosition will fix this.
		app.setPosition();
	}
});




//****************************************************************************************************
//****************************************************************************************************
//
//Helper functions
//****************************************************************************************************
//****************************************************************************************************
//Helper function: Find closest rotation entry.
function returnClosestRotation(tokenDocument, tokenRotation){
	//Create variable to hold the target rotation file suffix matrix.
	let targetRotationFilesuffixMatrix;
	//Fetch the state on the token specific flags.
	const overrideGlobalSettings = tokenDocument.getFlag(MODULE_ID, "overrideGlobalSettings") ?? false;
	const localSwappingEnabled = tokenDocument.getFlag(MODULE_ID, "localSwappingEnabled") ?? false;
	const localRotationFilesuffixMatrix = tokenDocument.getFlag(MODULE_ID, "localRotationFilesuffixMatrix");
	if (overrideGlobalSettings && localSwappingEnabled && Array.isArray(localRotationFilesuffixMatrix) && localRotationFilesuffixMatrix.length > 0) {
		//Use local matrix
		targetRotationFilesuffixMatrix = localRotationFilesuffixMatrix;
	} else {
		//Use global matrix.
		targetRotationFilesuffixMatrix = game.settings.get(MODULE_ID, "rotationFilesuffixMatrix");
	}
	//Ensure we have a matrix
	if (!Array.isArray(targetRotationFilesuffixMatrix) || targetRotationFilesuffixMatrix.length === 0) {
		//If no matrix exist, show a warning to the user and return.
		ui.notifications.warn(game.i18n.localize("swapper.Warnings.Warning003"));
		return null;
	}
	//Declare the shortest difference as a number higher than any realistic rotation.
	let shortestDifference = Number.MAX_SAFE_INTEGER;
	//Declare which target rotation is the closest.
	let closestTarget = targetRotationFilesuffixMatrix[0];
	for (let i = 0; i < targetRotationFilesuffixMatrix.length; i++){
		//Because of the circular angle wraparound problem (e.g., 355° is closer to 315° than to 0°), 
		//we calculate both the raw and modular differences to the target rotation and compare.
        let rawDifference = Math.abs(tokenRotation - targetRotationFilesuffixMatrix[i].rotation);
        let modularDifference = Math.min(rawDifference, 360 - rawDifference);
		//If the evaluated target is closer than the current candidate in shortestDifference, 
		//update the reference.
		if(modularDifference <= shortestDifference){
			closestTarget = targetRotationFilesuffixMatrix[i];
			shortestDifference = modularDifference;
		}
	}
	return closestTarget;
};


//Helper function: Determine if this token should swap images on rotation.
function imageSwappingSettingsForThisToken(tokenDocument) {
	//Get the state of global configuration settings.
	const globalSwappingEnabled = game.settings.get(MODULE_ID, "globalSwappingEnabled");
	//Get the states of token specific configuration settings.
	const localTokenFlags = tokenDocument.flags[MODULE_ID] || {};
	const overrideGlobalSettings = localTokenFlags.overrideGlobalSettings;
	const localSwappingEnabled = localTokenFlags.localSwappingEnabled;
	//Evaluate if this specific token should override global configuration.
	if(overrideGlobalSettings === true && localSwappingEnabled === true) {
		//Return true if token specific image swapping is enabled.
		return true;
	}
	else if (overrideGlobalSettings === true && localSwappingEnabled === false){
		//Return false if token specific configuration is disabled. 
		return false;
	}
	else{
		//Defer to global image swapping setting.
		return globalSwappingEnabled;
	};
};