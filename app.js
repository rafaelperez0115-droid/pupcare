/* PupCare — Lógica principal de la aplicación */
/* Generado en Paso 3 de refactorización */

// ── Funciones de autenticación expuestas GLOBALMENTE ─────────────────────────
// Se definen aquí (fuera del DOMContentLoaded) para que estén disponibles
// en cuanto el loginScreen aparece, antes de que el DOM termine de cargar.
// Las variables firebase/auth/db se definen dentro del DOMContentLoaded,
// pero estas funciones las acceden en el momento en que se llaman (más tarde).

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .catch(function(error) {
      console.error("Error Google Auth:", error);
      const msg = error.message || "Error al iniciar con Google";
      if(typeof showToast === "function") showToast(msg, "error");
      else alert(msg);
    });
}

function loginUser() {
  const email    = document.getElementById("authEmail")?.value?.trim();
  const password = document.getElementById("authPassword")?.value;
  if(!email || !password) {
    if(typeof showToast === "function") showToast("Completa email y contraseña.", "warning");
    return;
  }
  const btn = document.querySelector(".btn-login");
  if(btn){ btn.classList.add("btn-loading"); btn.textContent = "Entrando…"; }
  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(function(error) {
      if(typeof showToast === "function") showToast("Error: " + error.message, "error");
      if(btn){ btn.classList.remove("btn-loading"); btn.textContent = "Entrar"; }
    });
}

function registerUser() {
  const email    = document.getElementById("authEmail")?.value?.trim();
  const password = document.getElementById("authPassword")?.value;
  if(!email || !password) {
    if(typeof showToast === "function") showToast("Completa email y contraseña.", "warning");
    return;
  }
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .catch(function(error) {
      if(typeof showToast === "function") showToast("Error: " + error.message, "error");
    });
}

function logoutUser() {
  firebase.auth().signOut().catch(function(e){ console.error(e); });
}

// ── Todo lo demás espera al DOM ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

    // 0. GESTIÓN DEL TEMA
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); themeToggle.checked = true; }
    function syncThemeColor(isDark){
      // Sincroniza el color de la barra de estado del SO con el tema activo
      var color = isDark ? "#080b14" : "#f0effe";
      document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){
        m.setAttribute("content", color);
      });
    }
    themeToggle.addEventListener('change', function(e) {
      if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        syncThemeColor(true);
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        syncThemeColor(false);
      }
    });
    // Sincronizar al cargar (por si el anti-flicker ya aplicó dark)
    syncThemeColor(document.documentElement.getAttribute('data-theme') === 'dark');

    function openSettings() { document.getElementById('settingsDrawer').classList.add('open'); }
    function closeSettings() { document.getElementById('settingsDrawer').classList.remove('open'); }

    // ESCALADO DE TEXTO
    const SCALE_LABELS = { "0.85":"Pequeño", "1":"Normal", "1.15":"Grande", "1.3":"Máximo" };
    function setScale(btn){
      document.querySelectorAll(".scale-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const scale = btn.dataset.scale;
      document.documentElement.style.setProperty("--font-scale", scale);
      localStorage.setItem("fontScale", scale);
      const preview = document.getElementById("scalePreview");
      if(preview) preview.textContent = "Tamaño actual: " + (SCALE_LABELS[scale] || scale);
    }
    // Restaurar escala guardada
    (function(){
      const saved = localStorage.getItem("fontScale");
      if(saved && saved !== "1"){
        document.documentElement.style.setProperty("--font-scale", saved);
        // DOM ya disponible (estamos dentro de DOMContentLoaded)
        const btn = document.querySelector(`.scale-opt[data-scale="${saved}"]`);
        if(btn){
          document.querySelectorAll(".scale-opt").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const preview = document.getElementById("scalePreview");
          if(preview) preview.textContent = "Tamaño actual: " + (SCALE_LABELS[saved] || saved);
        }
      }
    })();
    window.setScale = setScale;

    // 1. INICIALIZAR FIREBASE
    const firebaseConfig = {
      apiKey: "AIzaSyA4WoVC9xK7bR5buMHsx9TvbpilGxGc7fo",
      authDomain: "pupcare-68e86.firebaseapp.com",
      projectId: "pupcare-68e86",
      storageBucket: "pupcare-68e86.firebasestorage.app",
      messagingSenderId: "324660274249",
      appId: "1:324660274249:web:913e9514a760d6c9124b98"
    };

    firebase.initializeApp(firebaseConfig);
    const db      = firebase.firestore();
    const auth    = firebase.auth();
    const storage = firebase.storage();

    // VARIABLES GLOBALES (Vacías por defecto)
    let currentUser = null;
    let myPets = [];
    let currentPetId = null;
    const appState = {}; 

    function resetAppState(id, name, breed) {
      const freshState = {
        pet: { id: id, name: name, breed: breed, birthDate: "", currentWeight: "", avatar: "", notes: "" },
        feedingPlan: { type: "", amountDaily: "", schedule: "", notes: "" },
        weightLogs: [], vaccines: [], deworming: [], medications: [], vetVisits: [], care: [], activity: [], feedingLogs: [], documents: [], album: []
      };
      for(let key in appState) delete appState[key];
      Object.assign(appState, JSON.parse(JSON.stringify(freshState)));
    }

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => [...document.querySelectorAll(sel)];

    // 2. LÓGICA DE USUARIOS Y SESIÓN
    auth.onAuthStateChanged(async user => {
      const loader = document.getElementById("loadingScreen");
      if (user) {
        currentUser = user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appShell').style.display = 'block';
        document.getElementById('tabbar').style.display = 'grid';
        document.getElementById('fabBtn').style.display = 'block';
        document.getElementById("userEmailDisplay").textContent = user.email || user.displayName || "Cuenta de Google";
        await loadUserPets();
        loader.classList.add("hidden");
        setTimeout(() => loader.style.display = "none", 400);
      } else {
        currentUser = null;
        loader.classList.add("hidden");
        setTimeout(() => loader.style.display = "none", 400);
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('appShell').style.display = 'none';
        document.getElementById('tabbar').style.display = 'none';
        document.getElementById('fabBtn').style.display = 'none';
      }
    });

    async function registerUser() {
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value.trim();
      if(!email || !password) return showToast("Por favor, ingresa correo y contraseña.", "warning");
      const btn = event.target; btn.classList.add("btn-loading"); btn.textContent = "Creando cuenta…";
      try { await auth.createUserWithEmailAndPassword(email, password); } 
      catch (error) { showToast("Error: " + error.message, "error"); btn.classList.remove("btn-loading"); btn.textContent = "Crear cuenta"; }
    }

    async function loginUser() {
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value.trim();
      if(!email || !password) return showToast("Por favor, ingresa correo y contraseña.", "warning");
      const btn = event.target; btn.classList.add("btn-loading"); btn.textContent = "Entrando…";
      try { await auth.signInWithEmailAndPassword(email, password); } 
      catch (error) { showToast("Error: " + error.message, "error"); btn.classList.remove("btn-loading"); btn.textContent = "Entrar"; }
    }

    // Las funciones loginWithGoogle, loginUser, registerUser, logoutUser
    // están definidas globalmente al inicio del archivo (fuera del DOMContentLoaded)
    // para que estén disponibles antes de que el DOM cargue completamente.

    // 3. CONEXIÓN A FIRESTORE (AISLADO POR USUARIO)
    async function loadUserPets() {
      try {
        const snapshot = await db.collection("users").doc(currentUser.uid).collection("mascotas").get();
        myPets = [];
        if (!snapshot.empty) {
          snapshot.forEach(doc => { myPets.push({ id: doc.id, name: doc.data().pet.name }); });
          
          currentPetId = localStorage.getItem("currentPetId_" + currentUser.uid) || myPets[0].id;
          if(!myPets.find(p => p.id === currentPetId)) currentPetId = myPets[0].id;
          
          await loadLocal();
          updatePetSwitcher();
          renderAll();
        } else {
          // Si el usuario es nuevo, la app empieza vacía y abre el panel para crear mascota
          currentPetId = null;
          resetAppState("temp", "Sin mascota", "");
          updatePetSwitcher();
          renderAll();
          openDrawer("newPet");
        }
      } catch (error) { console.error("Error al cargar mascotas:", error); }
    }

    async function saveLocal(){
      if(!currentUser || !currentPetId) return;
      try {
        // Excluimos "album" del documento padre: las fotos viven en la subcolección fotos/
        const { album: _excluded, ...dataToSave } = appState;
        await db.collection("users").doc(currentUser.uid)
          .collection("mascotas").doc(currentPetId)
          .set(dataToSave);
      } catch (error) { console.error("Error al guardar en Firestore:", error); }
    }

    async function loadLocal(){
      if(!currentUser || !currentPetId) return;
      try {
        const docRef = db.collection("users").doc(currentUser.uid).collection("mascotas").doc(currentPetId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          Object.assign(appState, docSnap.data());
        }
        // Cargar el álbum desde la subcolección (migra automáticamente si hay datos legacy)
        await loadAlbum();
      } catch (error) { console.error("Error al cargar de Firestore:", error); }
    }

    function updatePetSwitcher() {
      const switcher = $("#petSwitcher");
      if(!switcher) return;
      switcher.innerHTML = "";
      
      if (myPets.length === 0) {
        const opt = document.createElement("option");
        opt.value = ""; opt.textContent = "Añade una mascota";
        switcher.appendChild(opt);
      } else {
        myPets.forEach(p => {
          const opt = document.createElement("option");
          opt.value = p.id; opt.textContent = p.name;
          if(p.id === currentPetId) opt.selected = true;
          switcher.appendChild(opt);
        });
      }
      
      const addOpt = document.createElement("option");
      addOpt.value = "ADD_NEW"; addOpt.textContent = "➕ Añadir mascota...";
      switcher.appendChild(addOpt);
    }

    // 4. LÓGICA DEL CAJÓN MULTIUSO Y FORMULARIOS
    const TODAY = new Date().toISOString().split('T')[0];

    const ACTIVITY_TYPES = [
      { label:"Paseo",        icon:"🚶", cls:"walk"  },
      { label:"Juego",        icon:"🎾", cls:"play"  },
      { label:"Entrenamiento",icon:"🏋️", cls:"train" },
      { label:"Natación",     icon:"🌊", cls:"swim"  },
      { label:"Otro",         icon:"✏️", cls:""      },
    ];
    const CARE_TYPES = [
      { label:"Baño",              icon:"🛁", cls:"bath"  },
      { label:"Corte de uñas",     icon:"✂️", cls:"nails" },
      { label:"Limpieza de orejas",icon:"👂", cls:"ears"  },
      { label:"Cepillado",         icon:"🪮", cls:"brush" },
      { label:"Otro",              icon:"✏️", cls:""      },
    ];
    const VACCINE_TYPES = ["Rabia","Moquillo","Parvovirus","Bordetella","Leptospirosis","Hepatitis","Parainfluenza","Otro"];
    const DURATION_OPTS = ["10 min","15 min","30 min","45 min","1 hora","1.5 horas","2 horas"];
    const FREQ_OPTS     = ["Diario","Cada 12h","Cada 8h","Semanal","Quincenal","Mensual"];

    function getActivityIcon(type){
      const m = ACTIVITY_TYPES.find(a => a.label === type);
      return m ? m.icon : "🏃";
    }
    function getActivityCls(type){
      const m = ACTIVITY_TYPES.find(a => a.label === type);
      return m ? m.cls : "";
    }
    function getCareIcon(type){
      const icons = {"Baño":"🛁","Corte de uñas":"✂️","Limpieza de orejas":"👂","Cepillado":"🪮"};
      return icons[type] || "🧼";
    }
    function getCareCls(type){
      const cls = {"Baño":"bath","Corte de uñas":"nails","Limpieza de orejas":"ears","Cepillado":"brush"};
      return cls[type] || "";
    }

    function chipGroupHTML(items, name, multi=false){
      return `<div class="chip-group">${items.map(it =>
        `<button type="button" class="chip" data-group="${name}" data-val="${it.label || it}" onclick="toggleChip(this,'${name}',${multi})">${it.icon ? it.icon+' ' : ''}${it.label || it}</button>`
      ).join('')}</div>`;
    }
    function durationBtnsHTML(){
      return `<div class="duration-btns">${DURATION_OPTS.map(d =>
        `<button type="button" class="dur-btn" data-dur="${d}" onclick="selectDur(this,'${d}')">${d}</button>`
      ).join('')}</div>`;
    }

    function toggleChip(el, group, multi){
      if(!multi){
        document.querySelectorAll(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
      }
      el.classList.toggle('selected');
      // Mostrar input "Otro" si aplica
      const otroWrap = document.getElementById('otroWrap');
      if(otroWrap){
        const otroSelected = [...document.querySelectorAll(`.chip[data-group="${group}"].selected`)].some(c => c.dataset.val === 'Otro');
        otroWrap.classList.toggle('visible', otroSelected);
      }
    }
    function selectDur(el, val){
      document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('selected'));
      el.classList.add('selected');
      const custom = document.getElementById('customDur');
      if(custom) custom.style.display = val === 'Otro' ? 'block' : 'none';
    }
    function getChipVal(group){
      const sel = document.querySelector(`.chip[data-group="${group}"].selected`);
      if(!sel) return '';
      if(sel.dataset.val === 'Otro'){
        const inp = document.getElementById('otroInput');
        return inp ? inp.value.trim() : '';
      }
      return sel.dataset.val;
    }
    function getDurVal(){
      const sel = document.querySelector('.dur-btn.selected');
      return sel ? sel.dataset.dur : (document.getElementById('customDur')?.value.trim() || '');
    }
    window.toggleChip = toggleChip;
    window.selectDur  = selectDur;

    function openDrawer(type = "main"){
      $("#drawer").classList.add("open");
      const content = $("#drawerContent");

      const menuPrincipal = `
        <div class="quick-actions">
          <button class="quick" onclick="openDrawer('vaccine')"><strong>💉 Vacuna</strong><small>Selecciona y fecha</small></button>
          <button class="quick" onclick="openDrawer('feedingLog')"><strong>🍗 Comida</strong><small>Hora y cantidad</small></button>
          <button class="quick" onclick="openDrawer('activity')"><strong>🚶 Actividad</strong><small>Un toque, sin escribir</small></button>
          <button class="quick" onclick="openDrawer('weight')"><strong>⚖️ Peso</strong><small>Registrar crecimiento</small></button>
          <button class="quick" onclick="openDrawer('care')"><strong>🛁 Cuidado</strong><small>Baño, uñas, orejas…</small></button>
        </div>`;

      const templates = {
        main: { title: "Acciones rápidas", subtitle: "¿Qué quieres registrar?", html: menuPrincipal },
        task: { title: "Nueva Tarea",       subtitle: "Selecciona una opción",    html: menuPrincipal },

        newPet: {
          title: "Nueva Mascota", subtitle: "Añade un nuevo cachorro a la manada",
          html: `<div class="form-grid">
              <div class="field"><label>Nombre</label><input class="input" id="newPetName" placeholder="Ej: Luna"></div>
              <div class="field"><label>Raza</label><input class="input" id="newPetBreed" placeholder="Ej: Golden Retriever"></div>
            </div>
            <button class="primary-btn" style="margin-top:15px;width:100%" onclick="createNewPet()">🐾 Crear Perfil</button>`
        },

        vaccine: {
          title: "💉 Nueva vacuna", subtitle: "Toca para seleccionar, luego pon las fechas",
          html: `
            <span class="chip-label">Nombre de la vacuna</span>
            ${chipGroupHTML(VACCINE_TYPES.map(v=>({label:v,icon:''})), 'vaccine')}
            <div class="other-input-wrap" id="otroWrap">
              <input class="input" id="otroInput" placeholder="Nombre de la vacuna..." style="margin-top:4px">
            </div>
            <div class="form-grid" style="margin-top:16px">
              <div class="field">
                <label>Fecha aplicada</label>
                <input class="input" id="newVaccineDate" type="date" value="${TODAY}" onchange="validateVaccineDates()">
                <span class="field-error" id="vacDateErr">La fecha aplicada no puede ser futura</span>
              </div>
              <div class="field">
                <label>Próxima dosis</label>
                <input class="input" id="newVaccineNext" type="date" onchange="validateVaccineDates()">
                <span class="field-error" id="vacNextErr">La próxima dosis debe ser después de la aplicación</span>
              </div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addVaccine()">Guardar Vacuna</button>`
        },

        weight: {
          title: "⚖️ Registrar peso", subtitle: "Nuevo control de crecimiento",
          html: `
            <div class="field">
              <label>Unidad de medida</label>
              <div class="weight-unit-row">
                <button type="button" class="unit-card active" data-unit="kg" onclick="selectWeightUnit(this)">
                  kg <small>Kilogramos</small>
                </button>
                <button type="button" class="unit-card" data-unit="lb" onclick="selectWeightUnit(this)">
                  lb <small>Libras</small>
                </button>
              </div>
            </div>
            <div class="form-grid" style="margin-top:4px">
              <div class="field">
                <label>Fecha</label>
                <input class="input" id="newWeightDate" type="date" value="${TODAY}">
              </div>
              <div class="field">
                <label>Peso (<span id="weightUnitLabel">kg</span>)</label>
                <input class="input" id="newWeightValue" type="number" step="0.1" min="0" placeholder="Ej: 13.5">
                <span class="field-error" id="weightErr">Ingresa un peso válido mayor a 0</span>
              </div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addWeightLog()">Guardar Peso</button>`
        },

        feedingLog: {
          title: "🍗 Registrar comida", subtitle: "Guarda la comida del momento",
          html: `<div class="form-grid">
              <div class="field"><label>Hora</label><input class="input" id="newFeedTime" type="time" value="${new Date().toTimeString().slice(0,5)}"></div>
              <div class="field"><label>Cantidad (Ej: 110g)</label><input class="input" id="newFeedAmount" placeholder="Ej: 110 g"></div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addFeedingLog()">Guardar Comida</button>`
        },

        activity: {
          title: "🏃 Registrar Actividad", subtitle: "Toca el tipo de actividad",
          html: `
            <span class="chip-label">Tipo de actividad</span>
            ${chipGroupHTML(ACTIVITY_TYPES, 'actType')}
            <div class="other-input-wrap" id="otroWrap">
              <input class="input" id="otroInput" placeholder="Describe la actividad..." style="margin-top:4px">
            </div>
            <div style="margin-top:16px">
              <span class="chip-label">Duración</span>
              ${durationBtnsHTML()}
            </div>
            <div class="field" style="margin-top:16px">
              <label>Fecha</label>
              <input class="input" id="newActDate" type="date" value="${TODAY}">
            </div>
            <div class="field">
              <label>Nota (opcional)</label>
              <input class="input" id="newActNote" placeholder="Ej: Fue al parque central">
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addActivity()">Guardar Actividad</button>`
        },

        care: {
          title: "🛁 Rutina de cuidado", subtitle: "Toca el tipo de cuidado",
          html: `
            <span class="chip-label">¿Qué cuidado realizaste?</span>
            ${chipGroupHTML(CARE_TYPES, 'careType')}
            <div class="other-input-wrap" id="otroWrap">
              <input class="input" id="otroInput" placeholder="Describe el cuidado..." style="margin-top:4px">
            </div>
            <div class="form-grid" style="margin-top:16px">
              <div class="field"><label>Última vez</label><input class="input" id="newCareLast" type="date" value="${TODAY}"></div>
              <div class="field"><label>Próxima vez</label><input class="input" id="newCareNext" type="date"></div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addCare()">Guardar Cuidado</button>`
        },

        deworm: {
          title: "💊 Desparasitación", subtitle: "Registra nueva dosis",
          html: `<div class="form-grid">
              <div class="field full"><label>Producto</label><input class="input" id="newDewormName" placeholder="Ej: Nexgard, Bravecto..."></div>
              <div class="field"><label>Fecha aplicada</label><input class="input" id="newDewormDate" type="date" value="${TODAY}"></div>
              <div class="field"><label>Próxima fecha</label><input class="input" id="newDewormNext" type="date"></div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addDeworm()">Guardar</button>`
        },

        medication: {
          title: "🧴 Medicamento", subtitle: "Añadir tratamiento activo",
          html: `<div class="form-grid">
              <div class="field full"><label>Nombre del medicamento</label><input class="input" id="newMedName" placeholder="Ej: Amoxicilina"></div>
              <div class="field"><label>Dosis</label><input class="input" id="newMedDose" placeholder="Ej: 250 mg"></div>
            </div>
            <div style="margin-top:4px">
              <span class="chip-label">Frecuencia</span>
              ${chipGroupHTML(FREQ_OPTS.map(f=>({label:f,icon:''})), 'medFreq')}
            </div>
            <button class="primary-btn" style="margin-top:16px;width:100%" onclick="addMedication()">Guardar</button>`
        },

        visit: {
          title: "🏥 Visita Veterinaria", subtitle: "Registro médico",
          html: `<div class="form-grid">
              <div class="field full"><label>Motivo de la visita</label><input class="input" id="newVisitReason" placeholder="Ej: Revisión anual, diarrea..."></div>
              <div class="field"><label>Fecha</label><input class="input" id="newVisitDate" type="date" value="${TODAY}"></div>
              <div class="field"><label>Veterinario (opcional)</label><input class="input" id="newVisitVet" placeholder="Nombre del veterinario"></div>
            </div>
            <button class="primary-btn" style="margin-top:4px;width:100%" onclick="addVisit()">Guardar</button>`
        },

        behavior: {
          title: "📝 Comportamiento", subtitle: "Añadir nota de conducta",
          html: `
            <span class="chip-label">Tipo de nota (opcional)</span>
            ${chipGroupHTML([
              {label:"Positivo",icon:"😊"},{label:"Alerta",icon:"⚠️"},{label:"Agresividad",icon:"😠"},
              {label:"Miedo",icon:"😨"},{label:"Energía alta",icon:"⚡"},{label:"Otro",icon:"📝"}
            ], 'behavType')}
            <div class="field" style="margin-top:16px">
              <label>Descripción</label>
              <input class="input" id="newBehaviorNote" placeholder="Describe el comportamiento...">
            </div>
            <button class="primary-btn" style="margin-top:8px;width:100%" onclick="addBehavior()">Guardar</button>`
        }
      };

      const tpl = templates[type] || templates.main;
      $("#drawerTitle").textContent = tpl.title;
      $("#drawerSubtitle").textContent = tpl.subtitle;
      content.innerHTML = tpl.html;
    }

    function closeDrawer(){ 
      if(myPets.length === 0) return showToast("Debes añadir al menos una mascota para empezar.", "warning");
      $("#drawer").classList.remove("open"); 
    }

    async function createNewPet(){
      const name = $("#newPetName").value.trim(); const breed = $("#newPetBreed").value.trim();
      if(!name) return showToast("El nombre es obligatorio.", "warning");
      const newId = "pet_" + Date.now();
      
      myPets.push({id: newId, name: name});
      
      currentPetId = newId;
      localStorage.setItem("currentPetId_" + currentUser.uid, currentPetId);
      
      resetAppState(newId, name, breed);
      await saveLocal(); 
      
      updatePetSwitcher();
      renderAll(); 
      $("#drawer").classList.remove("open");
      showToast(`¡${name} se ha añadido a tu manada! 🐾`, "success");
    }

    const formatDate = (dateStr) => { if (!dateStr) return "Sin fecha"; const d = new Date(dateStr + "T00:00:00"); return d.toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" }); };
    const calculateAge = (birthDate) => { if(!birthDate) return "--"; const birth = new Date(birthDate + "T00:00:00"); const today = new Date(); let months = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth()); if (today.getDate() < birth.getDate()) months--; if (months < 1) return "Menos de 1 mes"; if (months < 12) return `${months} mes${months > 1 ? "es" : ""}`; const years = Math.floor(months / 12); const rem = months % 12; return rem ? `${years} año${years>1?"s":""} y ${rem} mes${rem>1?"es":""}` : `${years} año${years>1?"s":""}`; };
    const daysUntil = (dateStr) => { if (!dateStr) return null; const now = new Date(); const target = new Date(dateStr + "T00:00:00"); return Math.ceil((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); };

    let _profileUnit = localStorage.getItem("weightUnit") || "kg";
    function selectProfileUnit(btn){
      document.querySelectorAll("#profileUnitToggle .unit-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _profileUnit = btn.dataset.unit;
      localStorage.setItem("weightUnit", _profileUnit);
    }
    window.selectProfileUnit = selectProfileUnit;

    let _weightUnit = localStorage.getItem("weightUnit") || "kg";
    function selectWeightUnit(btn){
      const parent = btn.closest(".weight-unit-row, .unit-toggle");
      if(parent) parent.querySelectorAll(".unit-card, .unit-btn").forEach(b => b.classList.remove("active"));
      else document.querySelectorAll(".unit-card, .unit-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _weightUnit = btn.dataset.unit;
      localStorage.setItem("weightUnit", _weightUnit);
      const label = document.getElementById("weightUnitLabel");
      if(label) label.textContent = _weightUnit;
    }
    window.selectWeightUnit = selectWeightUnit;

    // ===== VALIDACIÓN DE FECHAS DE VACUNA =====
    function validateVaccineDates(){
      const applied = document.getElementById("newVaccineDate")?.value;
      const next    = document.getElementById("newVaccineNext")?.value;
      const errDate = document.getElementById("vacDateErr");
      const errNext = document.getElementById("vacNextErr");
      let valid = true;
      if(applied && applied > TODAY){ errDate?.classList.add("visible"); document.getElementById("newVaccineDate")?.classList.add("error"); valid = false; }
      else { errDate?.classList.remove("visible"); document.getElementById("newVaccineDate")?.classList.remove("error"); }
      if(next && applied && next <= applied){ errNext?.classList.add("visible"); document.getElementById("newVaccineNext")?.classList.add("error"); valid = false; }
      else { errNext?.classList.remove("visible"); document.getElementById("newVaccineNext")?.classList.remove("error"); }
      return valid;
    }
    window.validateVaccineDates = validateVaccineDates;

    function addVaccine(){
      const name = getChipVal('vaccine');
      if(!name) return showToast("Selecciona o escribe el nombre de la vacuna.", "warning");
      if(!validateVaccineDates()) return showToast("Revisa las fechas antes de guardar.", "warning");
      appState.vaccines.unshift({ name, date: $("#newVaccineDate").value, nextDate: $("#newVaccineNext").value, status:"completada", priority:"alta" });
      renderAll(); closeDrawer(); showToast("Vacuna registrada correctamente. 💉", "success");
    }
    function addWeightLog(){
      const date  = $("#newWeightDate").value;
      const value = parseFloat($("#newWeightValue").value);
      const errEl = document.getElementById("weightErr");
      if(!date || !value || value <= 0){
        errEl?.classList.add("visible"); $("#newWeightValue")?.classList.add("error");
        return showToast("Completa fecha y peso válido.", "warning");
      }
      errEl?.classList.remove("visible"); $("#newWeightValue")?.classList.remove("error");
      // Convertir lb → kg para almacenamiento uniforme
      const weightKg = _weightUnit === "lb" ? +(value * 0.453592).toFixed(2) : value;
      appState.weightLogs.push({ date, weight: weightKg, unit: _weightUnit, originalValue: value });
      appState.weightLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      appState.pet.currentWeight = `${value} ${_weightUnit}`;
      renderAll(); closeDrawer(); showToast(`Peso registrado: ${value} ${_weightUnit} ⚖️`, "success");
    }
    function addFeedingLog(){
      const time = $("#newFeedTime").value; const amount = $("#newFeedAmount").value.trim();
      if(!time || !amount) return showToast("Completa hora y cantidad.", "warning");
      appState.feedingLogs.unshift({ time, amount, note:"" }); renderAll(); closeDrawer(); showToast("Comida registrada.", "success");
    }
    function addActivity(){
      const type = getChipVal('actType'); const date = $("#newActDate").value;
      if(!type) return showToast("Selecciona el tipo de actividad.", "warning");
      if(!date)  return showToast("Selecciona la fecha.", "warning");
      const duration = getDurVal() || "-";
      appState.activity.unshift({ type, duration, distance:"-", date, note: $("#newActNote")?.value.trim() || "" });
      renderAll(); closeDrawer(); showToast("Actividad registrada.", "success");
    }
    function addCare(){
      const type = getChipVal('careType');
      if(!type) return showToast("Selecciona el tipo de cuidado.", "warning");
      appState.care.unshift({ type, lastDate: $("#newCareLast").value, nextDate: $("#newCareNext").value, priority:"media" });
      renderAll(); closeDrawer(); showToast("Rutina de cuidado guardada.", "success");
    }
    function addDeworm(){
      const product = $("#newDewormName").value.trim();
      if(!product) return showToast("Completa el nombre del producto.", "warning");
      appState.deworming.unshift({ product, date: $("#newDewormDate").value, nextDate: $("#newDewormNext").value, status:"programada" });
      renderAll(); closeDrawer(); showToast("Desparasitación registrada.", "success");
    }
    function addMedication(){
      const name = $("#newMedName").value.trim();
      if(!name) return showToast("Completa el nombre del medicamento.", "warning");
      const frequency = getChipVal('medFreq') || "Diario";
      appState.medications.unshift({ name, dose: $("#newMedDose").value.trim(), frequency, alert:"", active:true });
      renderAll(); closeDrawer(); showToast("Medicamento añadido.", "success");
    }
    function addVisit(){
      const reason = $("#newVisitReason").value.trim();
      if(!reason) return showToast("Completa el motivo de la visita.", "warning");
      const vet = $("#newVisitVet")?.value.trim() || "";
      appState.vetVisits.unshift({ date: $("#newVisitDate").value, reason, vet, notes:"" });
      renderAll(); closeDrawer(); showToast("Visita registrada.", "success");
    }
    function addBehavior(){
      const note = $("#newBehaviorNote").value.trim();
      if(!note) return showToast("Escribe una descripción.", "warning");
      const tipo = getChipVal('behavType') || "Nota";
      appState.activity.unshift({ type:"Comportamiento", subtype: tipo, duration:"-", distance:"-", date: TODAY, note });
      renderAll(); closeDrawer(); showToast("Nota de comportamiento guardada.", "success");
    }

    // ===== TOAST NOTIFICATIONS =====
    function showToast(msg, type = "success", duration = 3000) {
      const icons = { success:"✅", error:"❌", info:"💬", warning:"⚠️" };
      const container = document.getElementById("toastContainer");
      const toast = document.createElement("div");
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span class="toast-icon">${icons[type]||"ℹ️"}</span><span>${msg}</span>`;
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = "toastOut .3s ease forwards";
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    // ===== MODAL DE CONFIRMACIÓN =====
    let _confirmCallback = null;
    function openConfirm(title, msg, onOk) {
      document.getElementById("confirmTitle").textContent = title;
      document.getElementById("confirmMsg").textContent = msg;
      _confirmCallback = onOk;
      document.getElementById("confirmModal").classList.add("open");
    }
    function closeConfirm() {
      document.getElementById("confirmModal").classList.remove("open");
      _confirmCallback = null;
    }

    // ===== ELIMINAR ITEM GENÉRICO =====
    function deleteItem(collection, index, label) {
      openConfirm(`¿Eliminar ${label}?`, "Esta acción no se puede deshacer.", async () => {
        appState[collection].splice(index, 1);
        await renderAll();
        showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} eliminado/a correctamente.`, "info");
      });
    }

    // ── Editar registro de peso ───────────────────────────────────────────────
    function editWeightLog(index){
      const log = appState.weightLogs[index];
      if(!log) return;
      const existing = document.getElementById("editWeightModal");
      if(existing) existing.remove();
      const displayVal  = log.originalValue !== undefined ? log.originalValue : log.weight;
      const displayUnit = log.unit || "kg";
      const modal = document.createElement("div");
      modal.id = "editWeightModal";
      modal.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)";
      modal.innerHTML = `
        <div style="background:var(--surface);border-radius:24px;padding:24px;width:100%;max-width:380px;border:1px solid var(--line);box-shadow:var(--shadow)">
          <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:4px">✏️ Editar registro de peso</h3>
          <p style="font-size:.8rem;color:var(--muted);margin-bottom:18px">Corrige la fecha o el valor</p>
          <label style="font-size:.8rem;color:var(--muted);font-weight:700;display:block;margin-bottom:6px">FECHA</label>
          <input id="editWeightDate" class="input" type="date" value="${log.date}" style="margin-bottom:14px">
          <label style="font-size:.8rem;color:var(--muted);font-weight:700;display:block;margin-bottom:6px">PESO (${displayUnit})</label>
          <input id="editWeightValue" class="input" type="number" step="0.1" min="0" value="${displayVal}" placeholder="Ej: 13.5" style="margin-bottom:22px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button class="ghost-btn" onclick="document.getElementById('editWeightModal').remove()">Cancelar</button>
            <button class="primary-btn" onclick="saveEditWeight(${index},'${displayUnit}')">Guardar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if(e.target === modal) modal.remove(); });
    }
    window.editWeightLog = editWeightLog;

    async function saveEditWeight(index, unit){
      const newDate  = document.getElementById("editWeightDate")?.value;
      const newValue = parseFloat(document.getElementById("editWeightValue")?.value);
      if(!newDate || isNaN(newValue) || newValue <= 0){
        return showToast("Completa fecha y peso válido.", "warning");
      }
      const weightKg = unit === "lb" ? +(newValue * 0.453592).toFixed(2) : newValue;
      appState.weightLogs[index] = {
        ...appState.weightLogs[index],
        date: newDate,
        weight: weightKg,
        unit: unit,
        originalValue: newValue
      };
      appState.weightLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      const last = appState.weightLogs[appState.weightLogs.length - 1];
      appState.pet.currentWeight = `${last.originalValue || last.weight} ${last.unit || "kg"}`;
      await saveLocal();
      renderAll();
      document.getElementById("editWeightModal")?.remove();
      showToast("Peso actualizado ✅", "success");
    }
    window.saveEditWeight = saveEditWeight;

    // ===== EDITAR VACUNA =====
    function editVaccine(index) {
      const v = appState.vaccines[index];
      openDrawer("_editVaccine");
      const content = $("#drawerContent");
      $("#drawerTitle").textContent = "Editar vacuna";
      $("#drawerSubtitle").textContent = "Modifica los datos de esta vacuna";
      content.innerHTML = `
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input class="input" id="editVacName" value="${v.name}"></div>
          <div class="field"><label>Fecha aplicada</label><input class="input" id="editVacDate" type="date" value="${v.date||''}"></div>
          <div class="field"><label>Próxima dosis</label><input class="input" id="editVacNext" type="date" value="${v.nextDate||''}"></div>
        </div>
        <button class="primary-btn" style="margin-top:15px;width:100%" onclick="saveEditVaccine(${index})">Guardar cambios</button>`;
    }
    async function saveEditVaccine(index) {
      const name = $("#editVacName").value.trim();
      if(!name) return showToast("El nombre es obligatorio.", "error");
      appState.vaccines[index].name = name;
      appState.vaccines[index].date = $("#editVacDate").value;
      appState.vaccines[index].nextDate = $("#editVacNext").value;
      await renderAll();
      closeDrawer();
      showToast("Vacuna actualizada correctamente.", "success");
    }
    window.saveEditVaccine = saveEditVaccine;
    window.editVaccine = editVaccine;

    // ===== ELIMINAR MASCOTA ACTUAL =====
    function confirmDeleteCurrentPet() {
      if(myPets.length <= 1) {
        showToast("Debes tener al menos una mascota registrada.", "warning");
        return;
      }
      const petName = appState.pet.name;
      openConfirm(`¿Eliminar a ${petName}?`, `Se borrarán todos los datos de ${petName} permanentemente.`, async () => {
        try {
          await db.collection("users").doc(currentUser.uid).collection("mascotas").doc(currentPetId).delete();
          myPets = myPets.filter(p => p.id !== currentPetId);
          currentPetId = myPets[0].id;
          localStorage.setItem("currentPetId_" + currentUser.uid, currentPetId);
          await loadLocal();
          updatePetSwitcher();
          renderAll();
          closeSettings();
          showToast(`${petName} fue eliminado/a de tu manada.`, "info");
        } catch(e) { showToast("Error al eliminar. Intenta de nuevo.", "error"); console.error(e); }
      });
    }
    window.confirmDeleteCurrentPet = confirmDeleteCurrentPet;
    window.deleteItem = deleteItem;
    window.openConfirm = openConfirm;
    window.closeConfirm = closeConfirm;

    window.openDrawer = openDrawer; window.closeDrawer = closeDrawer; window.createNewPet = createNewPet;
    window.addVaccine = addVaccine; window.addWeightLog = addWeightLog; window.addFeedingLog = addFeedingLog; window.addActivity = addActivity; window.addCare = addCare; window.addDeworm = addDeworm; window.addMedication = addMedication; window.addVisit = addVisit; window.addBehavior = addBehavior;

    // ── Funciones de UI llamadas desde onclick en el HTML ─────────────────────
    // loginUser, logoutUser, loginWithGoogle, registerUser son globales (ver inicio del archivo)
    window.openSettings     = openSettings;
    window.closeSettings    = closeSettings;

    function renderHeaderAndHero(){
      const avatarBox = $("#petAvatar");
      if(appState.pet.avatar){
        avatarBox.style.backgroundImage = `url('${appState.pet.avatar}')`;
        avatarBox.innerHTML = "";
      } else {
        avatarBox.style.backgroundImage = "none";
        avatarBox.innerHTML = "🐾";
      }

      $("#petBreedText").textContent = appState.pet.breed || "Raza desconocida";
      $("#petAgeText").textContent = calculateAge(appState.pet.birthDate);
      $("#petWeightText").textContent = appState.pet.currentWeight || "-- kg";
      $("#dailyFoodText").textContent = appState.feedingPlan.amountDaily || "--";
      const walk = appState.activity.find(a => a.type === "Paseo");
      $("#walkTodayText").textContent = walk ? `${walk.duration} · ${walk.distance}` : "Sin registro";

      const nextV = [...appState.vaccines].filter(v => v.nextDate).sort((a,b) => new Date(a.nextDate) - new Date(b.nextDate))[0];
      $("#nextVaccineText").textContent = nextV ? nextV.name : "Sin pendientes";
      $("#nextVaccineDateText").textContent = nextV ? formatDate(nextV.nextDate) : "Actualizado";

      const bath = appState.care.find(c => c.type === "Baño");
      $("#lastBathText").textContent = bath ? relativeFromDate(bath.lastDate) : "Sin registro";
      $("#bathDateText").textContent = bath ? formatDate(bath.lastDate) : "—";
      
      const de = appState.deworming[0];
      $("#dewormText").textContent = de ? "Activa" : "Sin plan";
      $("#dewormDateText").textContent = de ? `Próxima en ${daysUntil(de.nextDate)} días` : "—";

      // ── Mini stats en la tarjeta hero ─────────────────────────────────────
      const statVac  = document.getElementById("heroStatVac");
      const statPics = document.getElementById("heroStatPics");
      const statWalk = document.getElementById("heroStatWalk");
      if(statVac)  statVac.textContent  = appState.vaccines.length;
      if(statPics) statPics.textContent = (appState.album || []).length;
      if(statWalk) statWalk.textContent = appState.activity.filter(a => a.type === "Paseo").length;
    }

    function relativeFromDate(dateStr){ const d = daysUntil(dateStr); return d === null ? "Sin fecha" : (d === 0 ? "Hoy" : (d < 0 ? `Hace ${Math.abs(d)} días` : `En ${d} días`)); }
    function relativeToFuture(dateStr){ const d = daysUntil(dateStr); return d === 0 ? "hoy" : (d === 1 ? "mañana" : (d < 0 ? "vencida" : `en ${d} días`)); }

    function collectUpcomingTasks(){
      const tasks = [];
      appState.vaccines.forEach(v => { if(v.nextDate) tasks.push({ icon:"💉", title:`Vacuna: ${v.name}`, date:v.nextDate, tag:"Salud" }); });
      appState.care.forEach(c => { if(c.nextDate) tasks.push({ icon:"🧼", title:c.type, date:c.nextDate, tag:"Cuidado" }); });
      return tasks.sort((a,b)=> new Date(a.date) - new Date(b.date)).slice(0,8);
    }

    function renderUpcomingTasks(){
      const tasks = collectUpcomingTasks();

      // ── Calcular alertas urgentes (≤7 días) ──────────────────────────────
      const urgent = tasks.filter(t => {
        const d = daysUntil(t.date);
        return d !== null && d >= 0 && d <= 7;
      });
      const alertBox = document.getElementById("upcomingAlerts");
      if(alertBox){
        if(urgent.length > 0){
          alertBox.innerHTML = urgent.map(t => {
            const d = daysUntil(t.date);
            const isRed = d <= 2;
            return `<div class="alert-pill ${isRed ? 'alert-red' : 'alert-amber'}">
              <span class="alert-dot"></span>
              <span>${t.title} — ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `${d} días`}</span>
            </div>`;
          }).join("");
          alertBox.style.display = "flex";
        } else {
          alertBox.style.display = "none";
        }
      }

      // ── Renderizar lista con barra de urgencia ────────────────────────────
      const html = tasks.map(t => {
        const d     = daysUntil(t.date);
        const isRed = d !== null && d <= 2;
        const isAmb = d !== null && d > 2 && d <= 7;
        const countColor = isRed ? "ec-red" : isAmb ? "ec-amber" : "ec-green";
        const countLabel = d === null ? "" : d === 0 ? "Hoy" : d < 0 ? "Vencida" : `${d}d`;
        const progW = d === null ? 80 : Math.max(5, Math.min(100, 100 - (d / 30 * 100)));
        const progCls = isRed ? "pf-red" : isAmb ? "pf-amber" : "pf-purple";
        const taskStatus = appState.taskStatus || {};
        const statusKey  = `${t.title}_${t.date}`;
        const st = taskStatus[statusKey];
        let actionHtml = "";
        if(st === "done")   actionHtml = `<span class="task-badge badge-done">✓ Hecho</span>`;
        else if(st === "skip") actionHtml = `<span class="task-badge badge-skip">✕ Omitida</span>`;
        else actionHtml = `<div class="task-actions-btns">
          <button class="btn-task-ok"  onclick="setTaskStatus('${statusKey}','done')">✓</button>
          <button class="btn-task-skip" onclick="setTaskStatus('${statusKey}','skip')">✕</button>
        </div>`;

        return `<div class="task-item ${st === 'done' ? 'task-done' : st === 'skip' ? 'task-skip' : ''}">
          <div class="badge-icon">${t.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="item-title">${t.title}</div>
            <div class="item-meta">${formatDate(t.date)}</div>
            <div class="task-prog-bar"><div class="task-prog-fill ${progCls}" style="width:${progW}%"></div></div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            ${d !== null ? `<span class="task-count ${countColor}">${countLabel}</span>` : ""}
            ${actionHtml}
          </div>
        </div>`;
      }).join("");
      $("#upcomingTasks").innerHTML = html || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">No hay tareas próximas. ¡Todo al día! 🎉</p>`;
    }

    // ── Confirmar / omitir una tarea ──────────────────────────────────────────
    async function setTaskStatus(key, status){
      if(!appState.taskStatus) appState.taskStatus = {};
      appState.taskStatus[key] = status;
      await saveLocal();
      renderAll();
      showToast(status === "done" ? "¡Tarea completada! ✅" : "Tarea omitida.", status === "done" ? "success" : "info");
    }
    window.setTaskStatus = setTaskStatus;

    function renderRecentActivity(){
      $("#recentActivity").innerHTML = appState.activity.filter(a => a.type !== "Comportamiento").slice(0,4).map((a,i) => `
        <div class="log-item">
          <div class="badge-icon ${getActivityCls(a.type)}">${getActivityIcon(a.type)}</div>
          <div><div class="item-title">${a.type}</div><div class="item-meta">${formatDate(a.date)} · ${a.duration}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('activity',${i},'la actividad')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin actividad reciente.</p>`;
    }

    function renderHealthView(){
      $("#vaccineList").innerHTML = appState.vaccines.map((v,i) => `
        <div class="log-item">
          <div class="badge-icon">💉</div>
          <div><div class="item-title">${v.name}</div><div class="item-meta">Aplicada: ${formatDate(v.date)} · Próxima: ${v.nextDate ? formatDate(v.nextDate) : "—"}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-edit" onclick="editVaccine(${i})" title="Editar">✏️</button>
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('vaccines',${i},'la vacuna')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p class="note" style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin vacunas registradas.</p>`;

      $("#dewormList").innerHTML = appState.deworming.map((d,i) => `
        <div class="log-item">
          <div class="badge-icon">💊</div>
          <div><div class="item-title">${d.product}</div><div class="item-meta">Próxima: ${formatDate(d.nextDate)}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('deworming',${i},'la desparasitación')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p class="note" style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin registros.</p>`;

      $("#medicationList").innerHTML = appState.medications.map((m,i) => `
        <div class="log-item">
          <div class="badge-icon">🧴</div>
          <div><div class="item-title">${m.name}</div><div class="item-meta">${m.dose}${m.frequency ? ' · '+m.frequency : ''}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('medications',${i},'el medicamento')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p class="note" style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin medicamentos.</p>`;

      $("#vetVisitsList").innerHTML = appState.vetVisits.map((v,i) => `
        <div class="log-item">
          <div class="badge-icon">🏥</div>
          <div><div class="item-title">${v.reason}</div><div class="item-meta">${formatDate(v.date)}${v.vet ? ' · '+v.vet : ''}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('vetVisits',${i},'la visita')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p class="note" style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin visitas.</p>`;
    }

    function renderFeedingView(){
      $("#foodTypeInput").value = appState.feedingPlan.type;
      $("#foodAmountInput").value = appState.feedingPlan.amountDaily;
      $("#foodScheduleInput").value = appState.feedingPlan.schedule;
      $("#feedingLogsList").innerHTML = appState.feedingLogs.map((l,i) => `
        <div class="log-item">
          <div class="badge-icon">🍗</div>
          <div><div class="item-title">${l.time}</div><div class="item-meta">${l.amount}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('feedingLogs',${i},'el registro')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin registros de comida.</p>`;
    }

    function renderCareView(){
      $("#careList").innerHTML = appState.care.map((c,i) => `
        <div class="log-item">
          <div class="badge-icon ${getCareCls(c.type)}">${getCareIcon(c.type)}</div>
          <div><div class="item-title">${c.type}</div><div class="item-meta">Última: ${formatDate(c.lastDate)} · Próxima: ${formatDate(c.nextDate)}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('care',${i},'el cuidado')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin rutinas registradas.</p>`;

      const behavItems = appState.activity.filter(a => a.type === "Comportamiento");
      $("#behaviorList").innerHTML = behavItems.map((a,i) => `
        <div class="log-item">
          <div class="badge-icon behavior">📝</div>
          <div><div class="item-title">${a.subtype ? a.subtype+' — ' : ''}${a.note}</div><div class="item-meta">${formatDate(a.date)}</div></div>
          <div class="item-actions">
            <button class="btn-icon-sm btn-delete" onclick="deleteItem('activity',${appState.activity.indexOf(a)},'la nota')" title="Eliminar">🗑️</button>
          </div>
        </div>`).join("") || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">Sin notas de comportamiento.</p>`;
    }

    function renderProfileView(){
      $("#nameInput").value = appState.pet.name;
      $("#breedInput").value = appState.pet.breed;
      $("#birthInput").value = appState.pet.birthDate;
      $("#weightInput").value = appState.pet.currentWeight;
    }

    function drawWeightChart(){
      const canvas = $("#weightChart");
      if(!canvas) return;

      // ── Ajustar resolución al DPR del dispositivo (pantallas Retina) ────────
      const dpr    = window.devicePixelRatio || 1;
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      // Colores según el tema activo
      const COLOR_LINE    = "#6d5efc";
      const COLOR_DOT_BG  = isDark ? "#1e293b" : "#ffffff";
      const COLOR_GRID    = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
      const COLOR_AXIS    = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
      const COLOR_LABEL   = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.50)";

      // Tamaño lógico del canvas (el CSS controla el ancho visible)
      const cssW = canvas.offsetWidth  || 600;
      const cssH = canvas.offsetHeight || 200;
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width  = cssW + "px";
      canvas.style.height = cssH + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);           // escalar para DPR
      ctx.clearRect(0, 0, cssW, cssH);

      const data = appState.weightLogs;
      if(data.length === 0) return;

      // ── Márgenes: izquierda amplia para el eje Y, abajo para el eje X ───────
      const padL = 52;   // eje Y (etiquetas de peso)
      const padR = 20;
      const padT = 16;
      const padB = 36;   // eje X (etiquetas de fecha)

      const chartW = cssW - padL - padR;
      const chartH = cssH - padT - padB;

      // ── Calcular rango del eje Y con ticks limpios ───────────────────────────
      const rawMax = Math.max(...data.map(d => d.weight));
      const rawMin = Math.min(...data.map(d => d.weight));
      const range  = rawMax - rawMin || 1;

      // Elegir un intervalo "redondo" para los ticks del eje Y
      const roughStep = range / 4;
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
      const niceStep  = Math.ceil(roughStep / magnitude) * magnitude || 1;
      const yMin = Math.floor(rawMin / niceStep) * niceStep;
      const yMax = Math.ceil(rawMax  / niceStep) * niceStep;
      const yRange = yMax - yMin || niceStep;

      // Función para convertir un peso a coordenada Y
      const toY = (val) => padT + chartH - ((val - yMin) / yRange) * chartH;
      // Función para convertir índice de punto a coordenada X
      const toX = (i)   => padL + (data.length === 1 ? chartW / 2 : i * (chartW / (data.length - 1)));

      // ── Líneas de cuadrícula horizontales + etiquetas eje Y ─────────────────
      ctx.font      = `${11 * (cssW < 400 ? 0.85 : 1)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      let tick = yMin;
      while(tick <= yMax + 0.001){
        const y = toY(tick);
        // Línea de cuadrícula
        ctx.beginPath();
        ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y);
        ctx.strokeStyle = COLOR_GRID;
        ctx.lineWidth   = 1;
        ctx.stroke();
        // Etiqueta eje Y
        const unit = (data[data.length-1].unit || "kg");
        ctx.fillStyle = COLOR_LABEL;
        ctx.fillText(tick % 1 === 0 ? tick + " " + unit : tick.toFixed(1) + " " + unit, padL - 6, y);
        tick = Math.round((tick + niceStep) * 1000) / 1000;
      }

      // ── Línea del eje Y (borde izquierdo) ────────────────────────────────────
      ctx.beginPath();
      ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + chartH);
      ctx.strokeStyle = COLOR_AXIS;
      ctx.lineWidth   = 1;
      ctx.stroke();

      // ── Calcular puntos ───────────────────────────────────────────────────────
      const points = data.map((d, i) => ({ x: toX(i), y: toY(d.weight), ...d }));

      // ── Área rellena bajo la línea (degradado suave) ──────────────────────────
      const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
      grad.addColorStop(0,   isDark ? "rgba(109,94,252,0.28)" : "rgba(109,94,252,0.18)");
      grad.addColorStop(1,   "rgba(109,94,252,0.00)");
      ctx.beginPath();
      ctx.moveTo(points[0].x, padT + chartH);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length-1].x, padT + chartH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // ── Línea principal ───────────────────────────────────────────────────────
      ctx.beginPath();
      points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = COLOR_LINE;
      ctx.lineWidth   = 3;
      ctx.lineJoin    = "round";
      ctx.lineCap     = "round";
      ctx.stroke();

      // ── Puntos + etiquetas eje X ──────────────────────────────────────────────
      ctx.font         = `${11 * (cssW < 400 ? 0.85 : 1)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "top";

      points.forEach((p, i) => {
        // Punto (círculo)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle   = COLOR_DOT_BG;
        ctx.strokeStyle = COLOR_LINE;
        ctx.lineWidth   = 2.5;
        ctx.fill();
        ctx.stroke();

        // Etiqueta de fecha en el eje X
        const label = new Date(p.date + "T00:00:00")
          .toLocaleDateString("es-ES", { day:"numeric", month:"short" });
        ctx.fillStyle = COLOR_LABEL;
        ctx.fillText(label, p.x, padT + chartH + 7);
      });

      // ── Actualizar el footer con botones de edición (debajo del canvas) ───────
      $("#chartFooter").innerHTML = data.map((d) => {
        const display  = d.originalValue ? `${d.originalValue} ${d.unit||'kg'}` : `${d.weight} kg`;
        const realIdx  = appState.weightLogs.findIndex(w => w.date === d.date && w.weight === d.weight);
        const dateLabel = new Date(d.date + "T00:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"short"});
        return `<span class="chart-foot-item">
          <span>${dateLabel}: <strong>${display}</strong></span>
          <span class="chart-foot-actions">
            <button class="chart-foot-btn" onclick="editWeightLog(${realIdx})" title="Editar">✏️</button>
            <button class="chart-foot-btn" onclick="deleteItem('weightLogs',${realIdx},'el registro de peso')" title="Eliminar">🗑️</button>
          </span>
        </span>`;
      }).join("");
    }

    function setView(name){
      $$(".view").forEach(v => v.classList.remove("active"));
      $(`#view-${name}`).classList.add("active");
      $$(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.target === name));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderAll(){
      renderHeaderAndHero(); renderUpcomingTasks(); renderRecentActivity();
      renderHealthView(); renderFeedingView(); renderCareView(); renderProfileView(); renderAlbum();
      drawWeightChart();
      saveLocal(); 
    }

    function setupEvents(){
      $$(".tab-btn").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.target)));
      $$("[data-open-drawer]").forEach(btn => { btn.addEventListener("click", () => openDrawer(btn.dataset.openDrawer)); });

      $("#fabBtn").addEventListener("click", () => openDrawer("main"));
      $("#closeDrawerBtn").addEventListener("click", closeDrawer);
      
      $("#petSwitcher").addEventListener("change", async (e) => {
        if(e.target.value === "ADD_NEW") {
          e.target.value = currentPetId; 
          openDrawer("newPet"); 
        } else {
          currentPetId = e.target.value;
          localStorage.setItem("currentPetId_" + currentUser.uid, currentPetId);
          await loadLocal(); 
          renderAll();
        }
      });

      $("#changePhotoBtn").addEventListener("click", () => $("#photoInput").click());
      
      $("#photoInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 400; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            appState.pet.avatar = canvas.toDataURL("image/jpeg", 0.8);
            renderAll(); 
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
      
      $("#saveProfileBtn").addEventListener("click", async (e) => {
        const btn = e.target;
        btn.classList.add("btn-loading"); btn.textContent = "Guardando…";
        appState.pet.name = $("#nameInput").value.trim() || appState.pet.name;
        appState.pet.breed = $("#breedInput").value.trim() || appState.pet.breed;
        appState.pet.birthDate = $("#birthInput").value || appState.pet.birthDate;
        appState.pet.currentWeight = $("#weightInput").value.trim() || appState.pet.currentWeight;
        const petIndex = myPets.findIndex(p => p.id === currentPetId);
        if(petIndex > -1) { myPets[petIndex].name = appState.pet.name; updatePetSwitcher(); }
        await renderAll();
        btn.classList.remove("btn-loading"); btn.textContent = "Guardar perfil";
        showToast("¡Perfil guardado correctamente! ☁️", "success");
      });
      
      $("#saveFeedingBtn").addEventListener("click", () => {
        appState.feedingPlan.type = $("#foodTypeInput").value.trim();
        appState.feedingPlan.amountDaily = $("#foodAmountInput").value.trim();
        appState.feedingPlan.schedule = $("#foodScheduleInput").value.trim();
        renderAll(); showToast("¡Plan de alimentación guardado! ☁️", "success");
      });
    }

    function setupReveal(){
      const observer = new IntersectionObserver((entries)=>{ entries.forEach(entry => { if(entry.isIntersecting) entry.target.classList.add("show"); }); }, { threshold:.12 });
      $$(".reveal").forEach(el => observer.observe(el));
    }

    // =====================================================================
    //  ÁLBUM DE CRECIMIENTO — Subcolección Firestore
    //  Ruta: users/{uid}/mascotas/{petId}/fotos/{fotoId}
    // =====================================================================

    let _albumPendingFile = null;

    function fotosRef() {
      if(!currentUser || !currentPetId) throw new Error("Usuario o mascota no definidos");
      return db
        .collection("users").doc(currentUser.uid)
        .collection("mascotas").doc(currentPetId)
        .collection("fotos");
    }

    async function migrateAlbumIfNeeded() {
      const petRef = db.collection("users").doc(currentUser.uid)
                       .collection("mascotas").doc(currentPetId);
      const snap = await petRef.get();
      const data = snap.data() || {};
      const legacyAlbum = data.album;
      if (!Array.isArray(legacyAlbum) || legacyAlbum.length === 0) return;
      console.log(`🔄 Migrando ${legacyAlbum.length} foto(s) al nuevo esquema…`);
      const batch = db.batch();
      legacyAlbum.forEach(photo => {
        const docRef = fotosRef().doc(photo.id || Date.now().toString());
        batch.set(docRef, {
          id:        photo.id        || Date.now().toString(),
          month:     photo.month     || "",
          note:      photo.note      || "",
          url:       photo.url       || photo.img || "",
          deleteUrl: photo.deleteUrl || "",
          date:      photo.date      || TODAY,
        });
      });
      batch.update(petRef, { album: firebase.firestore.FieldValue.delete() });
      await batch.commit();
      console.log("✅ Migración completada.");
    }

    async function loadAlbum() {
      if (!currentUser || !currentPetId) return;
      try {
        await migrateAlbumIfNeeded();
        const snap = await fotosRef().orderBy("date", "asc").get();
        appState.album = [];
        snap.forEach(doc => appState.album.push(doc.data()));
      } catch (e) {
        console.warn("orderBy falló, reintentando sin orden:", e.message);
        try {
          const snap = await fotosRef().get();
          appState.album = [];
          snap.forEach(doc => appState.album.push(doc.data()));
        } catch(e2) {
          console.error("Error cargando álbum (sin permisos o sin red):", e2.message);
          if (!Array.isArray(appState.album)) appState.album = [];
        }
      }
    }

    function setupAlbum(){
      const fileInput = document.getElementById("albumFileInput");
      if(!fileInput) return;
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        _albumPendingFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = document.getElementById("albumPreview");
          if(preview){ preview.src = ev.target.result; preview.style.display = "block"; }
          document.getElementById("albumMonthInput").value = "";
          document.getElementById("albumNoteInput").value = "";
          document.getElementById("albumModal").classList.add("open");
        };
        reader.readAsDataURL(file);
        fileInput.value = "";
      });
    }

    function closeAlbumModal(){
      document.getElementById("albumModal").classList.remove("open");
      _albumPendingFile = null;
    }

    const IMGBB_KEY = "50c755e8007a1f2c54410f67f6481efb";

    async function uploadToImgBB(file){
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const body = new URLSearchParams();
      body.append("key", IMGBB_KEY);
      body.append("image", base64);
      const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body });
      if(!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if(!data.success) throw new Error((data.error && data.error.message) || "ImgBB error");
      const imgUrl = (data.data.url || data.data.display_url || "").replace("http://", "https://");
      const delUrl = data.data.delete_url || "";
      return { url: imgUrl, deleteUrl: delUrl };
    }

    // ── Llama a la Netlify Function y devuelve el HTML del reporte ─────────
    // archivoImagen: File object (foto nueva) — puede ser null si se pasa base64Directo
    // base64Directo:  string base64 ya calculado (para fotos existentes por URL)
    async function solicitarReporteMensual(mes, datosExtra, archivoImagen, base64Directo = null) {
      try {
        // Obtener base64: priorizar el base64 directo, si no convertir el File
        let fotoBase64 = base64Directo;
        if(!fotoBase64 && archivoImagen){
          fotoBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(archivoImagen);
          });
        }
        if(!fotoBase64) throw new Error("No se proporcionó imagen para analizar.");

        const res = await fetch("/.netlify/functions/generar-reporte", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ mes, datosExtra, fotoBase64 }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log("📦 Respuesta de la Netlify Function:", JSON.stringify(data).substring(0, 200));
        return data.reporte || "";
      } catch (e) {
        console.warn("⚠️ Reporte IA no disponible:", e.message);
        // Devolver un mensaje de error inline — no bloquea el flujo principal
        return `<div class="reporte-seccion reporte-error">
          <span class="reporte-icono">⚠️</span>
          <div>
            <strong class="reporte-titulo">Análisis no disponible</strong>
            <p class="reporte-texto">No se pudo generar el análisis en este momento. ${e.message}</p>
          </div>
        </div>`;
      }
    }

    async function saveAlbumPhoto(){
      if(!_albumPendingFile) return showToast("No hay imagen seleccionada.", "error");
      const month = document.getElementById("albumMonthInput").value.trim();
      if(!month) return showToast("Indica el mes o etapa de la foto.", "warning");
      const note = document.getElementById("albumNoteInput").value.trim();
      const btn = document.querySelector("#albumModal .btn-confirm-ok");
      if(btn){ btn.disabled = true; btn.textContent = "Subiendo…"; }

      try {
        // 1. Subir imagen a ImgBB
        const { url, deleteUrl } = await uploadToImgBB(_albumPendingFile);
        const photoId = Date.now().toString();

        // 2. Guardar la entrada base inmediatamente (sin esperar la IA)
        const entry = { id: photoId, month, note, url, deleteUrl, date: TODAY, reporte: "" };
        await fotosRef().doc(photoId).set(entry);
        if(!Array.isArray(appState.album)) appState.album = [];
        appState.album.unshift(entry);

        // 3. Cerrar modal y mostrar el álbum con indicador de carga
        closeAlbumModal();
        renderAlbum();
        showToast(`Foto del ${month} añadida. Generando análisis IA… 🤖`, "success");

        // 4. Mostrar skeleton de carga en la tarjeta recién creada
        const cardEl = document.querySelector(`.album-card[data-id="${photoId}"]`);
        const reporteBox = cardEl?.querySelector(".reporte-ai");
        if(reporteBox){
          reporteBox.innerHTML = `<div class="reporte-loading">
            <span class="reporte-spinner"></span>
            <span>Analizando desarrollo…</span>
          </div>`;
          reporteBox.style.display = "block";
        }

        // 5. Pedir el reporte a Gemini en paralelo (no bloquea la UI)
        const datosExtra = `Nota del propietario: ${note || "Sin nota"}. Peso actual: ${appState.pet?.currentWeight || "No registrado"}. Raza: ${appState.pet?.breed || "No especificada"}.`;
        const reporteHtml = await solicitarReporteMensual(month, datosExtra, _albumPendingFile || new Blob());

        // 6. Guardar el reporte en Firestore y en appState
        entry.reporte = reporteHtml;
        await fotosRef().doc(photoId).update({ reporte: reporteHtml });
        const idx = appState.album.findIndex(p => p.id === photoId);
        if(idx !== -1) appState.album[idx].reporte = reporteHtml;

        // 7. Actualizar la tarjeta en el DOM sin re-renderizar todo el álbum
        if(reporteBox){
          reporteBox.innerHTML = reporteHtml;
        } else {
          renderAlbum(); // fallback: re-render completo
        }
        showToast("¡Análisis de Gemini completado! 🧠", "success");

      } catch(e){
        console.error("Error subiendo foto:", e);
        const msg = e?.message || String(e);
        if(msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("missing")){
          showToast("Error de permisos en Firestore. Revisa las reglas de seguridad.", "error");
        } else if(msg.toLowerCase().includes("imgbb") || msg.toLowerCase().includes("http")){
          showToast("Error al subir la imagen a ImgBB. Revisa tu conexión.", "error");
        } else {
          showToast("Error: " + msg.substring(0, 80), "error");
        }
        if(btn){ btn.disabled = false; btn.textContent = "Guardar"; }
      }
    }

    function extractMonthNumber(str){
      const m = str.match(/\d+/);
      return m ? parseInt(m[0]) : 9999;
    }

    function renderAlbum(){
      if(!Array.isArray(appState.album)) appState.album = [];
      const grid = document.getElementById("albumGrid");
      if(!grid) return;
      if(appState.album.length === 0){
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--muted)">
          <div style="font-size:3rem;margin-bottom:12px">📷</div>
          <p style="font-size:.88rem;margin-bottom:16px">Aún no hay fotos.<br>Añade la primera foto de Guts.</p>
          <button class="primary-btn" style="width:auto;padding:12px 24px" onclick="document.getElementById('albumFileInput').click()">📸 Añadir primera foto</button>
        </div>`;
        return;
      }
      const sorted = [...appState.album].sort((a, b) =>
        extractMonthNumber(a.month) - extractMonthNumber(b.month)
      );
      // Construir el HTML de las tarjetas SIN incluir el reporte dentro del template
      // (el reporte puede contener comillas/backticks que rompen el template string)
      const reporteMap = {};
      sorted.forEach(p => { if(p.reporte) reporteMap[p.id] = p.reporte; });

      grid.innerHTML = sorted.map(p => {
        const tieneReporte = !!(p.reporte && p.reporte.trim().length > 0);
        const imgUrl = p.url || p.img || "";
        const btnAnalizar = tieneReporte
          ? `<button class="btn-reanalizar-ia" onclick="generarReporteFotoExistente('${p.id}')" title="Volver a analizar">🔄</button>`
          : `<button class="btn-analizar-ia"   onclick="generarReporteFotoExistente('${p.id}')" title="Analizar con IA">🤖 Analizar con IA</button>`;
        return `<div class="album-card" data-id="${p.id}">
          <div class="album-foto-wrap" onclick="openLightbox('${p.id}')">
            <img src="${imgUrl}" alt="${p.month}" loading="lazy">
            <div class="album-overlay">
              <span class="album-month">${p.month}</span>
              ${p.note ? `<span class="album-note">${p.note}</span>` : ""}
            </div>
          </div>
          <div class="album-card-actions">
            ${btnAnalizar}
            <button class="album-edit"   onclick="editAlbumPhoto('${p.id}')"   title="Editar">✏️</button>
            <button class="album-delete" onclick="deleteAlbumPhoto('${p.id}')" title="Eliminar">🗑️</button>
          </div>
          <div class="reporte-ai" style="display:${tieneReporte ? 'block' : 'none'}"></div>
        </div>`;
      }).join("");

      // Inyectar el HTML del reporte DESPUÉS de construir el DOM
      // Así evitamos que comillas o backticks del reporte rompan el template
      sorted.forEach(p => {
        if(!reporteMap[p.id]) return;
        const card = grid.querySelector(`.album-card[data-id="${p.id}"]`);
        const box  = card?.querySelector(".reporte-ai");
        if(box){
          box.innerHTML    = reporteMap[p.id];
          box.style.display = "block";
        }
      });
    }

    // ── Generar reporte IA para una foto ya existente en el álbum ───────────
    async function generarReporteFotoExistente(photoId){
      const photo = appState.album?.find(p => p.id === photoId);
      if(!photo) return showToast("Foto no encontrada.", "error");

      const imgUrl = photo.url || photo.img;
      if(!imgUrl) return showToast("Esta foto no tiene URL válida.", "error");

      // 1. Mostrar skeleton de carga en la tarjeta
      const cardEl  = document.querySelector(`.album-card[data-id="${photoId}"]`);
      const reporteBox = cardEl?.querySelector(".reporte-ai");
      const btnAnalizar = cardEl?.querySelector(".btn-analizar-ia, .btn-reanalizar-ia");

      if(btnAnalizar){
        btnAnalizar.disabled    = true;
        btnAnalizar.textContent = "Analizando…";
      }
      if(reporteBox){
        reporteBox.innerHTML = `<div class="reporte-loading">
          <span class="reporte-spinner"></span>
          <span>Analizando desarrollo de Guts…</span>
        </div>`;
        reporteBox.style.display = "block";
      }

      try {
        // 2. Descargar la imagen y convertirla a base64
        //    Usamos un canvas para evitar problemas de CORS con imágenes de ImgBB
        const fotoBase64 = await urlToBase64(imgUrl);

        // 3. Preparar contexto extra con los datos de la mascota
        const datosExtra = [
          `Nota: ${photo.note || "Sin nota"}`,
          `Fecha de la foto: ${photo.date || "No registrada"}`,
          `Peso actual: ${appState.pet?.currentWeight || "No registrado"}`,
          `Raza: ${appState.pet?.breed || "No especificada"}`,
        ].join(". ");

        // 4. Llamar a Gemini
        const reporteHtml = await solicitarReporteMensual(
          photo.month,
          datosExtra,
          null,          // no hay archivo File — pasamos base64 directamente
          fotoBase64     // base64 de la URL
        );

        // 5. Guardar en Firestore y en appState
        await fotosRef().doc(photoId).update({ reporte: reporteHtml });
        const idx = appState.album.findIndex(p => p.id === photoId);
        if(idx !== -1) appState.album[idx].reporte = reporteHtml;

        // 6. Log de diagnóstico para verificar el reporte recibido
        console.log("✅ Reporte recibido de Gemini:", reporteHtml?.substring(0, 120));
        console.log("✅ Longitud del reporte:", reporteHtml?.length);

        // 7. Verificar que el reporte tiene contenido real
        if(!reporteHtml || reporteHtml.trim().length < 10){
          throw new Error("Gemini devolvió una respuesta vacía o inválida.");
        }

        // 8. Guardar en appState primero (renderAlbum lo leerá de aquí)
        const idx2 = appState.album.findIndex(p => p.id === photoId);
        if(idx2 !== -1){
          appState.album[idx2].reporte = reporteHtml;
          console.log("✅ Reporte guardado en appState, índice:", idx2);
        } else {
          console.warn("⚠️ No se encontró la foto en appState con id:", photoId);
        }

        // 9. Re-renderizar el álbum completo — lee de appState que ya tiene el reporte
        renderAlbum();

        // 10. Scroll suave a la tarjeta actualizada
        setTimeout(() => {
          const updatedCard = document.querySelector(`.album-card[data-id="${photoId}"]`);
          if(updatedCard) updatedCard.scrollIntoView({ behavior:"smooth", block:"nearest" });
        }, 150);

        showToast("¡Análisis de Guts completado! 🧠", "success");

      } catch(err){
        console.error("Error generando reporte:", err);
        if(reporteBox){
          reporteBox.innerHTML = `<div class="reporte-seccion reporte-error">
            <span class="reporte-icono">⚠️</span>
            <div>
              <strong class="reporte-titulo">Error al analizar</strong>
              <p class="reporte-texto">${err.message || "Intenta de nuevo."}</p>
            </div>
          </div>`;
        }
        if(btnAnalizar){
          btnAnalizar.disabled    = false;
          btnAnalizar.textContent = "🤖 Reintentar";
        }
        showToast("No se pudo generar el análisis.", "error");
      }
    }
    window.generarReporteFotoExistente = generarReporteFotoExistente;

    // ── Convierte una URL de imagen a base64 via canvas (evita CORS) ─────────
    async function urlToBase64(url){
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas  = document.createElement("canvas");
            canvas.width  = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } catch(e){
            // Si el canvas falla por CORS, hacer fetch directo
            fetchToBase64(url).then(resolve).catch(reject);
          }
        };
        img.onerror = () => fetchToBase64(url).then(resolve).catch(reject);
        img.src = url;
      });
    }

    // Fallback: fetch + FileReader para convertir a base64
    async function fetchToBase64(url){
      const res  = await fetch(url);
      if(!res.ok) throw new Error(`No se pudo descargar la imagen (HTTP ${res.status})`);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader  = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Orden actual de fotos para la navegación (sincronizado con renderAlbum)
    let _lightboxOrder = [];

    function openLightbox(id){
      // Reconstruir el orden igual que renderAlbum (por número de mes)
      _lightboxOrder = [...(appState.album || [])].sort(
        (a, b) => extractMonthNumber(a.month) - extractMonthNumber(b.month)
      );
      _showLightboxPhoto(id);
      document.getElementById("lightbox").classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function _showLightboxPhoto(id){
      const photo = _lightboxOrder.find(p => p.id === id);
      if(!photo) return;
      const idx   = _lightboxOrder.indexOf(photo);
      const total = _lightboxOrder.length;

      document.getElementById("lightboxImg").src         = photo.url || photo.img || "";
      document.getElementById("lightboxMonth").textContent = photo.month;
      document.getElementById("lightboxNote").textContent  = photo.note || "";
      document.getElementById("lightbox").dataset.activeId = id;

      // Contador "2 / 5"
      document.getElementById("lightboxCounter").textContent = `${idx + 1} / ${total}`;

      // Habilitar/deshabilitar botones en los extremos
      document.getElementById("lightboxPrev").disabled = idx === 0;
      document.getElementById("lightboxNext").disabled = idx === total - 1;
    }

    function navigateLightbox(dir){
      const currentId = document.getElementById("lightbox").dataset.activeId;
      const idx = _lightboxOrder.findIndex(p => p.id === currentId);
      const next = _lightboxOrder[idx + dir];
      if(next) _showLightboxPhoto(next.id);
    }

    function closeLightbox(){
      document.getElementById("lightbox").classList.remove("open");
      document.body.style.overflow = "";
    }
    window.openLightbox     = openLightbox;
    window.closeLightbox    = closeLightbox;
    window.navigateLightbox = navigateLightbox;
    window.saveAlbumPhoto   = saveAlbumPhoto;
    window.closeAlbumModal  = closeAlbumModal;

    async function deleteAlbumPhoto(id){
      openConfirm("¿Eliminar foto?", "La foto se borrará del álbum permanentemente.", async () => {
        const photo = appState.album?.find(p => p.id === id);
        if(photo?.deleteUrl){
          try { await fetch(photo.deleteUrl, { method: "GET", mode: "no-cors" }); } catch(e){ console.warn("ImgBB delete:", e); }
        }
        await fotosRef().doc(id).delete();
        appState.album = appState.album.filter(p => p.id !== id);
        renderAlbum();
        showToast("Foto eliminada.", "info");
      });
    }
    window.deleteAlbumPhoto = deleteAlbumPhoto;

    function editAlbumPhoto(id){
      const photo = appState.album?.find(p => p.id === id);
      if(!photo) return;
      const existing = document.getElementById("editPhotoModal");
      if(existing) existing.remove();
      const modal = document.createElement("div");
      modal.id = "editPhotoModal";
      modal.style.cssText = "position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(6px)";
      modal.innerHTML = `
        <div style="background:var(--surface);border-radius:24px;padding:24px;width:100%;max-width:380px;border:1px solid var(--line);box-shadow:var(--shadow)">
          <h3 style="font-size:1.1rem;font-weight:800;margin-bottom:4px">✏️ Editar foto</h3>
          <p style="font-size:.8rem;color:var(--muted);margin-bottom:18px">Corrige el mes o la descripción</p>
          <label style="font-size:.8rem;color:var(--muted);font-weight:700;display:block;margin-bottom:6px">MES / ETAPA</label>
          <input id="editMonthInput" class="input" value="${photo.month}" placeholder="Ej: Mes 1, 3 meses…" style="margin-bottom:14px">
          <label style="font-size:.8rem;color:var(--muted);font-weight:700;display:block;margin-bottom:6px">DESCRIPCIÓN</label>
          <input id="editNoteInput" class="input" value="${photo.note||""}" placeholder="Descripción opcional…" style="margin-bottom:22px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <button class="ghost-btn" onclick="document.getElementById('editPhotoModal').remove()">Cancelar</button>
            <button class="primary-btn" onclick="saveEditPhoto('${id}')">Guardar</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (e) => { if(e.target === modal) modal.remove(); });
    }
    window.editAlbumPhoto = editAlbumPhoto;

    async function saveEditPhoto(id){
      const newMonth = document.getElementById("editMonthInput")?.value.trim();
      const newNote  = document.getElementById("editNoteInput")?.value.trim();
      if(!newMonth) return showToast("El mes no puede estar vacío.", "warning");
      const photo = appState.album?.find(p => p.id === id);
      if(!photo) return;
      photo.month = newMonth;
      photo.note  = newNote || "";
      try {
        await fotosRef().doc(id).update({ month: newMonth, note: newNote || "" });
        document.getElementById("editPhotoModal")?.remove();
        renderAlbum();
        showToast("Foto actualizada ✅", "success");
      } catch(e){
        console.error(e);
        showToast("Error al guardar.", "error");
      }
    }
    window.saveEditPhoto = saveEditPhoto;

    // Inicializar la app (DOM ya disponible dentro del DOMContentLoaded exterior)
    setupEvents();
    setupReveal();
    setupAlbum();

    document.getElementById("confirmOkBtn").addEventListener("click", () => {
      if(_confirmCallback) _confirmCallback();
      closeConfirm();
    });

    document.addEventListener("keydown", (e) => {
      if(e.key === "Escape")     closeLightbox();
      if(e.key === "ArrowLeft")  navigateLightbox(-1);
      if(e.key === "ArrowRight") navigateLightbox(1);
    });

    // Swipe táctil en el lightbox
    let _touchStartX = 0;
    const lb = document.getElementById("lightbox");
    lb.addEventListener("touchstart", (e) => { _touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend",   (e) => {
      const diff = e.changedTouches[0].clientX - _touchStartX;
      if(Math.abs(diff) > 50) navigateLightbox(diff < 0 ? 1 : -1);
    });

});
