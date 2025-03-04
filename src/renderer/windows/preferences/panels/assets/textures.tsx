import * as React from "react";

import { InspectorList } from "../../../../editor/gui/inspector/fields/list";
import { InspectorSection } from "../../../../editor/gui/inspector/fields/section";
import { InspectorBoolean } from "../../../../editor/gui/inspector/fields/boolean";
import { InspectorFileInput } from "../../../../editor/gui/inspector/fields/file-input";

import { IPreferencesPanelProps } from "../../index";

export class AssetsTexturesPreferencesPanel extends React.Component<IPreferencesPanelProps> {
	/**
	 * Renders the component.
	 */
	public render(): React.ReactNode {
		const workspace = this.props.preferences.state.workspace;
		if (!workspace) {
			return null;
		}

		workspace.ktx2CompressedTextures ??= {};
		workspace.ktx2CompressedTextures.forcedFormat ??= "automatic";
		workspace.ktx2CompressedTextures.astcOptions ??= {
			quality: "astcveryfast",
		};
		workspace.ktx2CompressedTextures.pvrtcOptions ??= {
			quality: "pvrtcfastest",
		};
		workspace.ktx2CompressedTextures.ect1Options ??= {
			enabled: false,
			quality: "etcfast",
		};
		workspace.ktx2CompressedTextures.ect2Options ??= {
			enabled: false,
			quality: "etcfast",
		};

		return (
			<div style={{ width: "70%", height: "100%", margin: "auto" }}>
				<InspectorSection title="KTX2 Compression">
					<InspectorBoolean object={workspace.ktx2CompressedTextures} property="enabled" label="Enabled" defaultValue={false} />
					<InspectorFileInput object={workspace.ktx2CompressedTextures} property="pvrTexToolCliPath" label="PVRTexToolCLI Path" />

					<InspectorSection title="Development">
						<InspectorBoolean object={workspace.ktx2CompressedTextures} property="enabledInPreview" label="Enabled In Preview" defaultValue={false} />
						<InspectorList object={workspace.ktx2CompressedTextures} property="forcedFormat" label="Forced Format" items={[
							{ label: "Automatic", data: "automatic" },
							{ label: "ASTC", data: "-astc.ktx" },
							{ label: "DXT", data: "-dxt.ktx" },
							{ label: "PVRTC", data: "-pvrtc.ktx" },
							{ label: "ETC1", data: "-etc1.ktx" },
							{ label: "ETC2", data: "-etc2.ktx" },
						]} />
					</InspectorSection>

					<InspectorSection title="ASCT">
						<InspectorList object={workspace.ktx2CompressedTextures.astcOptions} property="quality" label="Quality" items={[
							{ label: "Very Fast", data: "astcveryfast" },
							{ label: "Fast", data: "astcfast" },
							{ label: "Medium", data: "astcmedium" },
							{ label: "Thorough", data: "astcthorough" },
							{ label: "Exhaustive", data: "astcexhaustive" },
						]} />
					</InspectorSection>

					<InspectorSection title="PVRTC">
						<InspectorList object={workspace.ktx2CompressedTextures.pvrtcOptions} property="quality" label="Quality" items={[
							{ label: "Fastest", data: "pvrtcfastest" },
							{ label: "Fast", data: "pvrtcfast" },
							{ label: "Low", data: "pvrtclow" },
							{ label: "Normal", data: "pvrtcnormal" },
							{ label: "High", data: "pvrtchigh" },
							{ label: "Very High", data: "pvrtcveryhigh" },
							{ label: "Thorough", data: "pvrtcthorough" },
							{ label: "Best", data: "pvrtcbest" },
						]} />
					</InspectorSection>

					<InspectorSection title="ETC1">
						<InspectorBoolean object={workspace.ktx2CompressedTextures.ect1Options} property="enabled" label="Enabled" defaultValue={false} />
						<InspectorList object={workspace.ktx2CompressedTextures.ect1Options} property="quality" label="Quality" items={[
							{ label: "Fast", data: "etcfast" },
							{ label: "Normal", data: "etcnormal" },
							{ label: "Slow", data: "etcslow" },
						]} />
					</InspectorSection>

					<InspectorSection title="ETC2">
						<InspectorBoolean object={workspace.ktx2CompressedTextures.ect2Options} property="enabled" label="Enabled" defaultValue={false} />
						<InspectorList object={workspace.ktx2CompressedTextures.ect2Options} property="quality" label="Quality" items={[
							{ label: "Fast", data: "etcfast" },
							{ label: "Normal", data: "etcnormal" },
							{ label: "Slow", data: "etcslow" },
						]} />
					</InspectorSection>
				</InspectorSection>
			</div>
		);
	}
}
