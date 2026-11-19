import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function initAnatomyViewer(config) {
    const modelPath = config.modelPath;
    const defaultCategory = config.category || "Anatomy";
    const fallbackName = config.fallbackName || defaultCategory;

    const container = document.getElementById("canvas-container");
    const selectionInfo = document.getElementById("selection-info");
    const partBanner = document.getElementById("part-banner");
    const bannerTitle = document.getElementById("banner-title");
    const bannerSubtitle = document.getElementById("banner-subtitle");

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // CAMERA
    const camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.01,
        1000
    );
    camera.position.set(0, 2, 3);

    // WEBGL RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // LIGHT
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    function cleanAnatomyName(rawName) {
        if (!rawName) return fallbackName;
        return rawName
            .replace(/_/g, " ")
            .replace(/Generated\s*Mesh\s*From\s*X3D\w*/gi, "")
            .replace(/\b\d+\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    // LOAD MODEL 3D
    let loadedModel = null;
    const loader = new GLTFLoader();
    loader.load(
        modelPath,
        (gltf) => {
            loadedModel = gltf.scene;

            loadedModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.userData.originalColor = child.material.color.clone();
                }
            });

            scene.add(loadedModel);

            const box = new THREE.Box3().setFromObject(loadedModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            loadedModel.position.sub(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 2.1;

            camera.position.set(0, 0, cameraZ);
            controls.target.set(0, 0, 0);
            controls.update();

            console.log(`Model ${modelPath} berhasil dimuat`);
        },
        undefined,
        (error) => {
            console.error(`Gagal memuat model 3D (${modelPath}):`, error);
        }
    );

    // RAYCASTER & INTERAKSI KLIK
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downCoords = { x: 0, y: 0 };
    let selectedMesh = null;

    renderer.domElement.addEventListener("pointerdown", (event) => {
        downCoords.x = event.clientX;
        downCoords.y = event.clientY;
    });

    renderer.domElement.addEventListener("pointerup", (event) => {
        const moveDistance = Math.hypot(event.clientX - downCoords.x, event.clientY - downCoords.y);
        if (moveDistance > 5 || !loadedModel) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(loadedModel.children, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const clickedMesh = hit.object;
            const materialName = clickedMesh.material ? clickedMesh.material.name : "";
            const rawName = clickedMesh.name || (clickedMesh.parent ? clickedMesh.parent.name : "") || materialName;

            if (selectedMesh && selectedMesh.userData.originalColor) {
                selectedMesh.material.color.copy(selectedMesh.userData.originalColor);
            }

            selectedMesh = clickedMesh;
            if (selectedMesh.material && selectedMesh.material.color) {
                selectedMesh.material.color.setHex(0xe5c07b);
            }

            let categoryTitle = defaultCategory;
            let partSubtitle = cleanAnatomyName(rawName);

            if (materialName.includes("Cartilage")) {
                categoryTitle = "Cartilage";
            }

            bannerTitle.textContent = categoryTitle;
            bannerSubtitle.textContent = partSubtitle;
            partBanner.classList.add("visible");

            if (selectionInfo) {
                selectionInfo.textContent = `Bagian terpilih: ${categoryTitle} — ${partSubtitle}`;
            }
        } else {
            if (selectedMesh && selectedMesh.userData.originalColor) {
                selectedMesh.material.color.copy(selectedMesh.userData.originalColor);
                selectedMesh = null;
            }
            partBanner.classList.remove("visible");
            if (selectionInfo) {
                selectionInfo.textContent = "Klik bagian pada model 3D untuk mendeteksi struktur.";
            }
        }
    });

    window.addEventListener("resize", () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}