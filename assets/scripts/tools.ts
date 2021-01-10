/**
 * Generated by the Babylon.JS Editor v${editor-version}
 */

import {
    Color3, Color4,
    SerializationHelper,
    Scene, Node, AbstractMesh, Mesh,
    Vector2, Vector3, Vector4,
    SSAO2RenderingPipeline, DefaultRenderingPipeline, ScreenSpaceReflectionPostProcess, MotionBlurPostProcess,
    Nullable,
} from "@babylonjs/core";

export type NodeScriptConstructor = (new (...args: any[]) => Node);
export type GraphScriptConstructor = (new (scene: Scene) => any);
export type ScriptMap = {
    [index: string]: {
        IsGraph?: boolean;
        default: (new (...args: any[]) => NodeScriptConstructor | GraphScriptConstructor);
    }
};

export interface IScript {
    /**
     * Called on the node is being initialized.
     * This function is called immediatly after the constructor has been called.
     */
    onInitialize?(): void;
    /**
     * Called on the scene starts.
     */
    onStart?(): void;
    /**
     * Called each frame.
     */
    onUpdate?(): void;
    /**
     * Called on a message has been received and sent from a graph.
     * @param message defines the name of the message sent from the graph.
     * @param data defines the data sent in the message.
     * @param sender defines the reference to the graph class that sent the message.
     */
    onMessage?(name: string, data: any, sender: any): void;
}

/**
 * Requires the nedded scripts for the given nodes array and attach them.
 * @param nodes the array of nodes to attach script (if exists).
 */
function requireScriptForNodes(scriptsMap: ScriptMap, nodes: (Node | Scene)[]): void {
    const initializedNodes: { node: Node | Scene; exports: any; }[] = [];

    // Initialize nodes
    for (const n of nodes as ((Scene | Node) & IScript)[]) {
        if (!n.metadata || !n.metadata.script || !n.metadata.script.name || n.metadata.script.name === "None") { continue; }

        const exports = scriptsMap[n.metadata.script.name];
        if (!exports) { continue; }

        // Get prototype.
        let prototype = exports.default.prototype;

        // Call constructor
        prototype.constructor.call(n);

        // Add prototype
        do {
            for (const key in prototype) {
                if (!prototype.hasOwnProperty(key) || key === "constructor") { continue; }
                n[key] = prototype[key].bind(n);
            }

            prototype = Object.getPrototypeOf(prototype);
        } while (prototype.constructor?.IsComponent === true);

        // Call onInitialize
        n.onInitialize?.call(n);

        initializedNodes.push({ node: n, exports });
    }

    // Configure initialized nodes
    for (const i of initializedNodes) {
        const n = i.node as (Scene | Node) & IScript;
        const e = i.exports;
        const scene = i.node instanceof Scene ? i.node : i.node.getScene();
        
        // Check start
        if (n.onStart) {
            let startObserver = scene.onBeforeRenderObservable.addOnce(() => {
                startObserver = null!;
                n.onStart();
            });
            
            n.onDisposeObservable.addOnce(() => {
                if (startObserver) {
                    scene.onBeforeRenderObservable.remove(startObserver);
                }
            });
        }

        // Check update
        if (n.onUpdate) {
            const updateObserver = scene.onBeforeRenderObservable.add(() => n.onUpdate());
            n.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(updateObserver));
        }

        // Check properties
        const properties = n.metadata.script.properties ?? { };
        for (const key in properties) {
            const p = properties[key];

            switch (p.type) {
                case "Vector2": n[key] = new Vector2(p.value.x, p.value.y); break;
                case "Vector3": n[key] = new Vector3(p.value.x, p.value.y, p.value.z); break;
                case "Vector4": n[key] = new Vector4(p.value.x, p.value.y, p.value.z, p.value.w); break;

                case "Color3": n[key] = new Color3(p.value.r, p.value.g, p.value.b); break;
                case "Color4": n[key] = new Color4(p.value.r, p.value.g, p.value.b, p.value.a); break;

                default: n[key] = p.value; break;
            }
        }

        // Check linked children.
        if (n instanceof Node) {
            const childrenLinks = (e.default as any)._ChildrenValues ?? [];
            for (const link of childrenLinks) {
                const child = n.getChildren((node => node.name === link.nodeName), true)[0];
                n[link.propertyKey] = child;
            }
        }

        // Check linked nodes from scene.
        const sceneLinks = (e.default as any)._SceneValues ?? [];
        for (const link of sceneLinks) {
            const node = scene.getNodeByName(link.nodeName);
            n[link.propertyKey] = node;
        }

        // Check particle systems
        const particleSystemLinks = (e.default as any)._ParticleSystemValues ?? [];
        for (const link of particleSystemLinks) {
            const ps = scene.particleSystems.filter((ps) => ps.emitter === n && ps.name === link.particleSystemName)[0];
            n[link.propertyKey] = ps;
        }

        // Check pointer events
        const pointerEvents = (e.default as any)._PointerValues ?? [];
        for (const event of pointerEvents) {
            scene.onPointerObservable.add((e) => {
                if (e.type !== event.type) { return; }
                if (!event.onlyWhenMeshPicked) { return n[event.propertyKey](e); }

                if (e.pickInfo?.pickedMesh === n) {
                    n[event.propertyKey](e);
                }
            });
        }

        // Check keyboard events
        const keyboardEvents = (e.default as any)._KeyboardValues ?? [];
        for (const event of keyboardEvents) {
            scene.onKeyboardObservable.add((e) => {
                if (event.type && e.type !== event.type) { return; }
                
                if (!event.keys.length) { return n[event.propertyKey](e); }

                if (event.keys.indexOf(e.event.keyCode) !== -1) {
                    n[event.propertyKey](e);
                }
            });
        }

        // Retrieve impostors
        if (n instanceof AbstractMesh && !n.physicsImpostor) {
            n.physicsImpostor = n._scene.getPhysicsEngine()?.getImpostorForPhysicsObject(n);
        }

        delete n.metadata.script;
    }
}

/**
 * Attaches all available scripts on nodes of the given scene.
 * @param scene the scene reference that contains the nodes to attach scripts.
 */
export function attachScripts(scriptsMap: ScriptMap, scene: Scene): void {
    requireScriptForNodes(scriptsMap, scene.meshes);
    requireScriptForNodes(scriptsMap, scene.lights);
    requireScriptForNodes(scriptsMap, scene.cameras);
    requireScriptForNodes(scriptsMap, scene.transformNodes);
    requireScriptForNodes(scriptsMap, [scene]);

    // Graphs
    for (const scriptKey in scriptsMap) {
        const script = scriptsMap[scriptKey];
        if (script.IsGraph) {
            const instance = new script.default(scene);
            scene.executeWhenReady(() => instance["onStart"]());
            scene.onBeforeRenderObservable.add(() => instance["onUpdate"]());
        }
    }
}

/**
 * Setups the rendering groups for meshes in the given scene.
 * @param scene defines the scene containing the meshes to configure their rendering group Ids.
 */
export function setupRenderingGroups(scene: Scene): void {
    scene.meshes.forEach((m) => {
        if (!m.metadata || !(m instanceof Mesh)) { return; }
        m.renderingGroupId = m.metadata.renderingGroupId ?? m.renderingGroupId;
    });
}

/**
 * Attaches the given script (according to its path in the given script map) to the given object.
 * @param scriptsMap defines the map containing all exported scripts of an Editor project.
 * @param scriptsKey defines the key in the scripts map of the script to attach to the given object.
 * @param object defines the reference to the object that the script must be attached to.
 */
export function attachScriptToNodeAtRumtine(scriptsMap: ScriptMap, scriptsKey: string, object: Node | Scene): any {
    object.metadata = object.metadata ?? { };
    object.metadata.script = object.metadata.script ?? { };
    object.metadata.script.name = scriptsKey;

    requireScriptForNodes(scriptsMap, [object]);
}

/**
 * Defines the reference to the SSAO2 rendering pipeline.
 */
export let ssao2RenderingPipelineRef: Nullable<SSAO2RenderingPipeline> = null;
/**
 * Defines the reference to the SSR post-process.
 */
export let screenSpaceReflectionPostProcessRef: Nullable<ScreenSpaceReflectionPostProcess> = null;
/**
 * Defines the reference to the default rendering pipeline.
 */
export let defaultRenderingPipelineRef: Nullable<DefaultRenderingPipeline> = null;
/**
 * Defines the reference to the motion blur post-process.
 */
export let motionBlurPostProcessRef: Nullable<MotionBlurPostProcess> = null;

/**
 * Configures and attaches the post-processes of the given scene.
 * @param scene the scene where to create the post-processes and attach to its cameras.
 * @param rootUrl the root Url where to find extra assets used by pipelines. Should be the same as the scene.
 */
export function configurePostProcesses(scene: Scene, rootUrl: string = null): void {
    if (rootUrl === null || !scene.metadata?.postProcesses) { return; }

    // Load  post-processes configuration
    const data = scene.metadata.postProcesses;

    if (data.ssao && !ssao2RenderingPipelineRef) {
        ssao2RenderingPipelineRef = SSAO2RenderingPipeline.Parse(data.ssao.json, scene, rootUrl);
        if (data.ssao.enabled) {
            scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(ssao2RenderingPipelineRef.name, scene.cameras);
        }
    }

    if (data.screenSpaceReflections?.json && !screenSpaceReflectionPostProcessRef) {
        screenSpaceReflectionPostProcessRef = ScreenSpaceReflectionPostProcess._Parse(data.screenSpaceReflections.json, scene.activeCamera!, scene, "");
    }

    if (data.default && !defaultRenderingPipelineRef) {
        defaultRenderingPipelineRef = DefaultRenderingPipeline.Parse(data.default.json, scene, rootUrl);
        if (!data.default.enabled) {
            scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(defaultRenderingPipelineRef.name, scene.cameras);
        }
    }

    if (data.motionBlur?.json) {
        motionBlurPostProcessRef = MotionBlurPostProcess._Parse(data.motionBlur.json, scene.activeCamera!, scene, "");
    }

    scene.onDisposeObservable.addOnce(() => {
        ssao2RenderingPipelineRef = null;
        screenSpaceReflectionPostProcessRef = null;
        defaultRenderingPipelineRef = null;
        motionBlurPostProcessRef = null;
    });
}

/**
 * Overrides the texture parser.
 */
(function overrideTextureParser(): void {
    const textureParser = SerializationHelper._TextureParser;
    SerializationHelper._TextureParser = (sourceProperty, scene, rootUrl) => {
        if (sourceProperty.isCube && !sourceProperty.isRenderTarget && sourceProperty.files && sourceProperty.metadata?.isPureCube) {
            sourceProperty.files.forEach((f, index) => {
                sourceProperty.files[index] = rootUrl + f;
            });
        }

        const texture = textureParser.call(SerializationHelper, sourceProperty, scene, rootUrl);

        if (sourceProperty.url) {
            texture.url = rootUrl + sourceProperty.url;
        }

        return texture;
    };
})();

/**
 * @deprecated will be moved to "./decorators.ts".
 */
export * from "./decorators";
