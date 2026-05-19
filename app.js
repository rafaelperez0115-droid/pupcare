/* PupCare — Lógica principal de la aplicación */
/* Generado en Paso 3 de refactorización */

document.addEventListener('DOMContentLoaded', function() {

    // 0. GESTIÓN DEL TEMA
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); themeToggle.checked = true; }
    function syncThemeColor(isDark){
      // Sincroniza el color de la barra de estado del SO con el tema activo
      var color = isDark ? "#0f172a" : "#f4f6fb";
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

    // NUEVO: Función para Iniciar Sesión con Google
    async function loginWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      try { await auth.signInWithPopup(provider); } 
      catch (error) { showToast("Error con Google: " + error.message, "error"); console.error(error); }
    }

    function logoutUser() {
      auth.signOut().then(() => {
        closeSettings();
        document.getElementById("authEmail").value = "";
        document.getElementById("authPassword").value = "";
      });
    }

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
      const html = collectUpcomingTasks().map(t => `
        <div class="task-item">
          <div class="badge-icon">${t.icon}</div>
          <div><div class="item-title">${t.title}</div><div class="item-meta">${formatDate(t.date)}</div></div>
        </div>`).join("");
      $("#upcomingTasks").innerHTML = html || `<p style="color:var(--muted);font-size:.85rem;padding:10px 0">No hay tareas próximas. ¡Todo al día! 🎉</p>`;
    }

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
      const ctx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0,0,w,h);
      const data = appState.weightLogs;
      if(data.length === 0) return;
      
      const pad = 24;
      const max = Math.max(...data.map(d => d.weight)) + 1;
      const min = Math.min(...data.map(d => d.weight)) - 1;

      const points = data.map((d, i) => {
        const x = pad + (i * ((w-pad*2) / (data.length - 1 || 1)));
        const y = h - pad - ((d.weight - min) / (max - min || 1)) * (h - pad*2);
        return {x,y,...d};
      });

      ctx.beginPath();
      points.forEach((p,i)=>{ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
      ctx.strokeStyle = "#6d5efc"; ctx.lineWidth = 4; ctx.stroke();

      points.forEach(p=>{
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff';
        ctx.fill(); ctx.stroke();
      });
      $("#chartFooter").innerHTML = data.map(d => {
        const display = d.originalValue ? `${d.originalValue} ${d.unit||'kg'}` : `${d.weight} kg`;
        return `<span>${new Date(d.date + "T00:00:00").toLocaleDateString("es-ES",{month:"short"})}: <strong>${display}</strong></span>`;
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
        try {
          const snap = await fotosRef().get();
          appState.album = [];
          snap.forEach(doc => appState.album.push(doc.data()));
        } catch(e2) {
          console.error("Error cargando álbum:", e2);
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

    async function saveAlbumPhoto(){
      if(!_albumPendingFile) return showToast("No hay imagen seleccionada.", "error");
      const month = document.getElementById("albumMonthInput").value.trim();
      if(!month) return showToast("Indica el mes o etapa de la foto.", "warning");
      const note = document.getElementById("albumNoteInput").value.trim();
      const btn = document.querySelector("#albumModal .btn-confirm-ok");
      if(btn){ btn.disabled = true; btn.textContent = "Subiendo…"; }
      try {
        const { url, deleteUrl } = await uploadToImgBB(_albumPendingFile);
        const photoId = Date.now().toString();
        const entry = { id: photoId, month, note, url, deleteUrl, date: TODAY };
        await fotosRef().doc(photoId).set(entry);
        if(!Array.isArray(appState.album)) appState.album = [];
        appState.album.unshift(entry);
        closeAlbumModal();
        renderAlbum();
        showToast(`Foto del ${month} añadida al álbum 📸`, "success");
      } catch(e){
        console.error("Error subiendo foto:", e);
        showToast("Error al subir la foto. Revisa tu conexión e intenta de nuevo.", "error");
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
      grid.innerHTML = sorted.map(p => `
        <div class="album-card" onclick="openLightbox('${p.id}')">
          <img src="${p.url || p.img}" alt="${p.month}" loading="lazy">
          <div class="album-overlay">
            <span class="album-month">${p.month}</span>
            ${p.note ? `<span class="album-note">${p.note}</span>` : ""}
          </div>
          <button class="album-delete" onclick="event.stopPropagation();deleteAlbumPhoto('${p.id}')" title="Eliminar">🗑️</button>
          <button class="album-edit" onclick="event.stopPropagation();editAlbumPhoto('${p.id}')" title="Editar">✏️</button>
        </div>`).join("");
    }

    function openLightbox(id){
      const photo = appState.album?.find(p => p.id === id);
      if(!photo) return;
      document.getElementById("lightboxImg").src = photo.url || photo.img || "";
      document.getElementById("lightboxMonth").textContent = photo.month;
      document.getElementById("lightboxNote").textContent = photo.note || "";
      document.getElementById("lightbox").dataset.activeId = id;
      document.getElementById("lightbox").classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function closeLightbox(){
      document.getElementById("lightbox").classList.remove("open");
      document.body.style.overflow = "";
    }
    window.openLightbox  = openLightbox;
    window.closeLightbox = closeLightbox;
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
      if(e.key === "Escape") closeLightbox();
    });

});
