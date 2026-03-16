const video = document.getElementById('video');
const statusMsg = document.getElementById('status-message');
const connectBtn = document.getElementById('connectArduino');
const studentDetails = document.querySelector('.student-details');
const placeholder = document.querySelector('.placeholder-text');

let port;
let writer;
let labeledFaceDescriptors = [];
let studentsData = [];
let isRelayActive = false; // Anti-rebond pour le relais

// 1. Gestion Arduino (Web Serial API)
connectBtn.addEventListener('click', async () => {
    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        connectBtn.textContent = "✅ Arduino Connecté";
        connectBtn.disabled = true;
    } catch (err) {
        console.error("Erreur connexion Arduino:", err);
        alert("Impossible de connecter l'Arduino.");
    }
});

async function sendSignalToArduino() {
    if (writer && !isRelayActive) {
        isRelayActive = true;
        const data = new Uint8Array([49]); // Envoie le caractère '1' (byte 49)
        await writer.write(data);
        
        // Temporisation logicielle pour éviter de spammer le relais
        setTimeout(() => { isRelayActive = false; }, 3000); 
    }
}

// 2. Chargement des modèles et démarrage
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri("/Reco-eleves/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("/Reco-eleves/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("/Reco-eleves/models")
]).then(startVideo);

async function startVideo() {
    // Charge les données JSON avant la vidéo
    await loadStudentsData();
    // Charge les descripteurs faciaux de référence
    labeledFaceDescriptors = await loadLabeledImages();
    
    statusMsg.innerText = "PRÊT À SCANNER";
    
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => video.srcObject = stream)
        .catch(err => console.error(err));
}

// Récupère le JSON
async function loadStudentsData() {
    const response = await fetch('students.json');
    studentsData = await response.json();
}

// Charge les images assets/1.png, etc. pour apprendre les visages
async function loadLabeledImages() {
    statusMsg.innerText = "CHARGEMENT DES PROFILS...";
    
    return Promise.all(
        studentsData.map(async student => {
            const descriptions = [];
            try {
                // Charge l'image depuis assets/ID.png
                const img = await faceapi.fetchImage(`./assets/${student.id}.png`);
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                
                if (detections) {
                    descriptions.push(detections.descriptor);
                    return new faceapi.LabeledFaceDescriptors(student.id, descriptions);
                } else {
                    console.warn(`Pas de visage détecté pour ${student.nom}`);
                    return null; // Gérer proprement si image invalide
                }
            } catch (e) {
                console.error(`Erreur chargement image pour ID ${student.id}`, e);
                return null;
            }
        })
    ).then(results => results.filter(res => res !== null)); // Filtre les erreurs
}

// 3. Boucle de reconnaissance
video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.querySelector('.video-container').append(canvas);
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        // Créer le comparateur de visages
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6); // Seuil de tolérance

        if (resizedDetections.length > 0) {
            const result = faceMatcher.findBestMatch(resizedDetections[0].descriptor);
            const box = resizedDetections[0].detection.box;
            
            // Affichage cadre (optionnel)
            // const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            // drawBox.draw(canvas);

            if (result.label !== 'unknown') {
                // --- ACCÈS AUTORISÉ ---
                const studentId = result.label;
                updateUI(studentId, true);
                sendSignalToArduino();
            } else {
                // --- ACCÈS REFUSÉ ---
                updateUI(null, false);
            }
        } else {
            // Personne devant la caméra
            resetUI();
        }
    }, 100);
});

function updateUI(id, isAuthorized) {
    statusMsg.className = ""; // Reset classes
    
    if (isAuthorized) {
        const student = studentsData.find(s => s.id === id);
        if (student) {
            statusMsg.innerText = "AUTORISÉ";
            statusMsg.classList.add("success");
            
            // Remplir la fiche
            document.getElementById('display-photo').src = `./assets/${student.id}.png`;
            document.getElementById('display-id').innerText = student.id;
            document.getElementById('display-nom').innerText = student.nom;
            document.getElementById('display-prenom').innerText = student.prenom;
            document.getElementById('display-classe').innerText = student.classe;

            placeholder.classList.add('hidden');
            studentDetails.classList.remove('hidden');
        }
    } else {
        statusMsg.innerText = "VOUS N'AVEZ PAS L'HABILITATION SUFFISANTE";
        statusMsg.classList.add("error");
        placeholder.classList.remove('hidden');
        studentDetails.classList.add('hidden');
    }
}

function resetUI() {
    statusMsg.innerText = "EN ATTENTE...";
    statusMsg.className = "neutral";
    placeholder.classList.remove('hidden');
    studentDetails.classList.add('hidden');
}
