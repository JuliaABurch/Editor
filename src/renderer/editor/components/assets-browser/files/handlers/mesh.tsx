import { basename, dirname, extname, join } from "path";

import * as React from "react";
import { Spinner, ContextMenu, Menu, MenuItem, MenuDivider, Icon as BPIcon } from "@blueprintjs/core";

import {
	PickingInfo, SceneLoader, Mesh, SubMesh,
} from "babylonjs";

import { Tools } from "../../../../tools/tools";

import { Icon } from "../../../../gui/icon";
import { Confirm } from "../../../../gui/confirm";

import { Workers } from "../../../../workers/workers";
import AssetsWorker from "../../../../workers/workers/assets";

import { AssetsBrowserItemHandler } from "../item-handler";
import { SceneImporterTools } from "../../../../scene/import-tools";

export class MeshItemHandler extends AssetsBrowserItemHandler {
	/**
	 * Computes the image to render.
	 */
	public async computePreview(): Promise<React.ReactNode> {
		this._computePreview();

		this.props.onSetTitleColor("#FFFF00");

		return (
			<div style={{ width: "100%", height: "100%" }}>
				<Icon src="logo-babylon.svg" style={{ width: "100%", height: "100%", filter: "unset" }} />
				<div style={{ position: "absolute", top: "0", left: "0" }}>
					<Spinner size={24} />
				</div>
			</div>
		);
	}

	/**
	 * Called on the user double clicks on the item.
	 * @param ev defines the reference to the event object.
	 */
	public onDoubleClick(_: React.MouseEvent<HTMLDivElement, MouseEvent>): void {
		this.props.editor.addWindowedPlugin("mesh-viewer", true, undefined, {
			rootUrl: join(dirname(this.props.absolutePath), "/"),
			name: basename(this.props.absolutePath),
		});
	}

	/**
	 * Called on the user starts dragging the item.
	 * @param ev defines the reference to the event object.
	 */
	public onDragStart(ev: React.DragEvent<HTMLDivElement>): void {
		ev.dataTransfer.setData("text", this.props.absolutePath);
		ev.dataTransfer.setData("asset/mesh", JSON.stringify({
			absolutePath: this.props.absolutePath,
			relativePath: this.props.relativePath,
		}));
	}

	/**
	 * Called on the user right clicks on the item.
	 * @param ev defines the reference to the event object.
	 */
	public onContextMenu(ev: React.MouseEvent<HTMLDivElement, MouseEvent>): void {
		ContextMenu.show((
			<Menu>
				<MenuItem text="Refresh Preview" icon={<BPIcon icon="refresh" color="white" />} onClick={() => {
					this.props.editor.assetsBrowser._callSelectedItemsMethod("_handleRefreshPreview");
				}} />
				<MenuDivider />
				<MenuItem text="Update Instantiated References">
					<MenuItem text="Force Update" onClick={() => this._handleUpdateInstantiatedReferences(true)} />
					<MenuItem text="Update Per Object" onClick={() => this._handleUpdateInstantiatedReferences(false)} />
				</MenuItem>
				<MenuDivider />
				{this.getCommonContextMenuItems()}
			</Menu>
		), {
			top: ev.clientY,
			left: ev.clientX,
		});
	}

	/**
	 * Called on the user wants to refresh the preview of the material.
	 * @hidden
	 */
	public async _handleRefreshPreview(): Promise<void> {
		await Workers.ExecuteFunction<AssetsWorker, "deleteFromCache">(
			AssetsBrowserItemHandler.AssetWorker,
			"deleteFromCache",
			this.props.relativePath,
		);

		return this._computePreview();
	}

	/**
	 * Computes the preview image of the object.
	 */
	private async _computePreview(): Promise<void> {
		const path = await Workers.ExecuteFunction<AssetsWorker, "createScenePreview">(
			AssetsBrowserItemHandler.AssetWorker,
			"createScenePreview",
			this.props.relativePath,
			this.props.absolutePath,
		);

		const previewImage = (
			<img
				ref={(r) => r && requestAnimationFrame(() => r.style.opacity = "1.0")}
				src={path}
				style={{
					width: "100%",
					height: "100%",
					opacity: "0",
					transition: "opacity 0.3s ease-in-out",
				}}
			/>
		);

		this.setState({ previewImage });
	}

	/**
	 * Prepares handler before the scene is loaded.
	 */
	private _prepareLoad(): void {
		require("babylonjs-loaders");
	}

	/**
	 * Called on the 
	 * @param ev defines the reference to the event object.
	 * @param pick defines the picking info generated while dropping in the preview.
	 */
	public async onDropInPreview(_: React.DragEvent<HTMLDivElement>, pick: PickingInfo): Promise<void> {
		this._prepareLoad();

		const scene = this.props.editor.scene!;

		const extension = extname(this.props.absolutePath).toLowerCase();
		const isGltf = extension === ".glb" || extension === ".gltf";

		const result = await SceneLoader.ImportMeshAsync("", join(dirname(this.props.absolutePath), "/"), basename(this.props.absolutePath), scene);
		scene.stopAllAnimations();

		SceneImporterTools.Configure(this.props.editor.scene!, {
			isGltf,
			result,
			editor: this.props.editor,
			relativePath: this.props.relativePath,
			absolutePath: this.props.absolutePath,
		}).then((n) => {
			n["position"]?.copyFrom(pick.pickedPoint);

			this.props.editor.assets.refresh();
			this.props.editor.assetsBrowser.refresh();
		});

		this.props.editor.graph.refresh();
	}

	/**
	 * Called on the user wants to update the already instantiated meshes. Allows to update per mesh
	 * which to update and chosse geometry, material, etc.
	 */
	private async _handleUpdateInstantiatedReferences(force: boolean): Promise<void> {
		if (force && !await Confirm.Show("Force Update?", "Are you sure to force update instantiated references?")) {
			return;
		}

		this._prepareLoad();

		const scene = this.props.editor.scene!;

		const extension = extname(this.props.absolutePath).toLowerCase();
		const isGltf = extension === ".glb" || extension === ".gltf";

		const container = await SceneLoader.LoadAssetContainerAsync(join(dirname(this.props.absolutePath), "/"), basename(this.props.absolutePath), scene);
		const instantiatedMeshes = scene.meshes.filter((m) => m.metadata?.originalSourceFile?.sceneFileName === this.props.relativePath);

		container.meshes.forEach((m) => {
			if (!m.id || !(m instanceof Mesh)) { return; }

			// Find all meshes instantiated with this original id
			const linkedMeshes = instantiatedMeshes.filter((im) => im.metadata?.originalSourceFile?.id === m.id);
			linkedMeshes.forEach((im) => {
				if (!(im instanceof Mesh)) {
					return;
				}

				const metadata = Tools.GetMeshMetadata(im);
				metadata._waitingUpdatedReferences = {};

				metadata._waitingUpdatedReferences.geometry = {
					geometry: m.geometry,
					skeleton: m.skeleton,
					subMeshes: m.subMeshes?.slice() ?? [],
					handler: (m, s) => this._updateInstantiatedGeometryReferences(m, s),
				};

				if (force) {
					this._updateInstantiatedGeometryReferences(im, false);
				}

				const material = m.material;
				if (material) {
					metadata._waitingUpdatedReferences.material = {
						isGltf,
						material,
						handler: (m) => this._updateInstantiatedMaterialReferences(m),
					};
				}

				if (force) {
					this._updateInstantiatedMaterialReferences(im);
				}
			});
		});

		this.props.editor.graph.refresh();
	}

	/**
	 * Called on the user wants to update the material of the mesh from source file.
	 */
	private _updateInstantiatedMaterialReferences(mesh: Mesh): void {
		const metadata = Tools.GetMeshMetadata(mesh);

		if (metadata._waitingUpdatedReferences?.material) {
			mesh.material = metadata._waitingUpdatedReferences.material?.material ?? null;

			if (mesh.material) {
				this.props.editor.scene!.addMaterial(mesh.material);
				SceneImporterTools.ConfigureMaterial(mesh.material, {
					editor: this.props.editor,
					relativePath: this.props.relativePath,
					absolutePath: this.props.absolutePath,
					isGltf: metadata._waitingUpdatedReferences.material.isGltf,
					result: {
						lights: [],
						meshes: [],
						skeletons: [],
						geometries: [],
						transformNodes: [],
						animationGroups: [],
						particleSystems: [],
					}
				}, true);
			}
		}

		delete metadata._waitingUpdatedReferences?.material;

		this.props.editor.graph.refresh();
	}

	/**
	 * Called on the user wants to update the geometry of the mesh from source file.
	 */
	private _updateInstantiatedGeometryReferences(mesh: Mesh, withSkeleton: boolean): void {
		const metadata = Tools.GetMeshMetadata(mesh);

		metadata._waitingUpdatedReferences?.geometry?.geometry?.applyToMesh(mesh);

		if (withSkeleton) {
			mesh.skeleton = metadata._waitingUpdatedReferences?.geometry?.skeleton ?? null;
		}

		if (metadata._waitingUpdatedReferences?.geometry?.subMeshes) {
			mesh.subMeshes = [];
			metadata._waitingUpdatedReferences.geometry.subMeshes.forEach((sm) => {
				new SubMesh(sm.materialIndex, sm.verticesStart, sm.verticesCount, sm.indexStart, sm.indexCount, mesh, mesh, true, true);
			});
		}

		delete metadata._waitingUpdatedReferences?.geometry;

		this.props.editor.graph.refresh();
	}
}
