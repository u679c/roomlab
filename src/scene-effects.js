import { DoubleSide } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Color stays full resolution; contact shading uses half-size buffers and 16 samples.
class ContactShadowsPass extends SSAOPass {
  setSize(width, height) {
    super.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)));
  }
}

export class SceneEffects {
  constructor(renderer, scene, camera, editorHelper) {
    this.renderer = renderer;
    this.editorHelper = editorHelper;
    this.composer = new EffectComposer(renderer);
    this.colorPass = new RenderPass(scene, camera);
    this.contactPass = new ContactShadowsPass(scene, camera, 1, 1, 16);
    this.outputPass = new OutputPass();
    this.contactPass.kernelRadius = 0.38;
    // The SSAO shader compares linear depth normalized by the camera depth range.
    const depthRange = camera.far - camera.near;
    this.contactPass.minDistance = 0.012 / depthRange;
    this.contactPass.maxDistance = 0.65 / depthRange;
    this.contactPass.normalMaterial.side = DoubleSide;
    // Preserve clean silhouette edges when rendering through offscreen buffers.
    this.composer.renderTarget1.samples = 2;
    this.composer.renderTarget2.samples = 2;
    this.composer.addPass(this.colorPass);
    this.composer.addPass(this.contactPass);
    this.composer.addPass(this.outputPass);
    // Transform handles should not generate occlusion on furniture underneath.
    const renderContact = this.contactPass.render.bind(this.contactPass);
    this.contactPass.render = (...args) => {
      const visible = editorHelper.visible;
      editorHelper.visible = false;
      try { renderContact(...args); }
      finally {
        editorHelper.visible = visible;
      }
    };
  }
  setSize(width, height) {
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
  }
  render() {
    // Update animated door/furniture shadows once, during the color pass only.
    const shadowMap = this.renderer.shadowMap;
    const autoUpdate = shadowMap.autoUpdate;
    shadowMap.autoUpdate = false;
    shadowMap.needsUpdate = true;
    try { this.composer.render(); }
    finally { shadowMap.autoUpdate = autoUpdate; }
  }
  dispose() {
    this.colorPass.dispose();
    this.contactPass.dispose();
    // SSAOPass does not release its sampling texture/material in this Three version.
    this.contactPass.noiseTexture.dispose();
    this.contactPass.ssaoMaterial.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}
