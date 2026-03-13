/**
 * Login/script.js — MySQL/XAMPP version
 * Authenticates owner via PHP/MySQL.
 * Staff login checks email + PIN against the staff table.
 */
document.addEventListener("DOMContentLoaded", () => {
    const overlay      = document.getElementById("overlay");
    const roleBox      = document.getElementById("roleBox");
    const loginBox     = document.getElementById("loginBox");
    const roleTitle    = document.getElementById("roleTitle");
    const loginBtn     = document.getElementById("loginBtn");
    const togglePassword = document.getElementById("togglePassword");
    const passwordInput  = document.getElementById("password");
    const emailInput     = document.getElementById("emailInput");
    const signInBtn      = document.getElementById("signInBtn");
    const backBtn        = document.getElementById("backBtn");
    const eyeBtn         = document.getElementById("eyeBtn");
    const passwordLabels = document.querySelectorAll(".auth-label");
    const passwordLabel  = passwordLabels[1];
    const emailLabel     = passwordLabels[0];

    let selectedRole = null;

    /* ── Toast ── */
    function showNotification(msg, color="#e53e3e") {
        let toast = document.getElementById("loginToast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "loginToast";
            Object.assign(toast.style, {
                position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",
                color:"#fff",padding:"10px 20px",borderRadius:"8px",
                boxShadow:"0 4px 12px rgba(0,0,0,0.2)",zIndex:"10000",
                fontSize:"14px",fontWeight:"600",opacity:"0",
                transition:"opacity 0.3s",pointerEvents:"none"
            });
            document.body.appendChild(toast);
        }
        toast.style.backgroundColor = color;
        toast.textContent = msg;
        requestAnimationFrame(()=>{ toast.style.opacity="1"; });
        clearTimeout(toast._timer);
        toast._timer = setTimeout(()=>{ toast.style.opacity="0"; }, 3000);
    }

    function setLoading(on) {
        signInBtn.disabled    = on;
        signInBtn.textContent = on ? "Signing in…" : "Sign In";
        signInBtn.style.opacity = on ? "0.7" : "1";
    }

    function applyRoleMode() {
        if (selectedRole === "Staff") {
            roleTitle.innerHTML      = `Login as: <b>Staff</b>`;
            emailLabel.textContent   = "Email";
            emailInput.type          = "email";
            emailInput.placeholder   = "Enter your staff email";
            passwordLabel.textContent = "Staff PIN";
            passwordInput.placeholder = "Enter 4-digit PIN";
            passwordInput.maxLength   = 4;
            passwordInput.setAttribute("inputmode","numeric");
            passwordInput.setAttribute("pattern","[0-9]{4}");
            passwordInput.value = "";
        } else {
            roleTitle.innerHTML      = `Login as: <b>Owner</b>`;
            emailLabel.textContent   = "Username / Email";
            emailInput.type          = "text";
            emailInput.placeholder   = "Owner username or manager email";
            passwordLabel.textContent = "Password / PIN";
            passwordInput.placeholder = "Enter password or 4-digit PIN";
            passwordInput.removeAttribute("maxlength");
            passwordInput.removeAttribute("inputmode");
            passwordInput.removeAttribute("pattern");
            passwordInput.value = "";
        }
    }

    loginBtn.addEventListener("click", ()=>{
        overlay.style.display  = "flex";
        roleBox.style.display  = "block";
        loginBox.style.display = "none";
    });

    document.querySelectorAll("[data-role]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            selectedRole = btn.dataset.role;
            roleBox.style.display  = "none";
            loginBox.style.display = "grid";
            applyRoleMode();
        });
    });

    backBtn.addEventListener("click", ()=>{
        loginBox.style.display = "none";
        roleBox.style.display  = "block";
        passwordInput.value    = "";
        togglePassword.checked = false;
        passwordInput.type     = "password";
        emailInput.style.borderColor    = "";
        passwordInput.style.borderColor = "";
    });

    passwordInput.addEventListener("input", ()=>{
        passwordInput.style.borderColor = "";
        if (selectedRole === "Staff") {
            passwordInput.value = passwordInput.value.replace(/\D/g,"").slice(0,4);
        }
    });
    emailInput.addEventListener("input", ()=>{ emailInput.style.borderColor=""; });
    togglePassword.addEventListener("change", ()=>{
        passwordInput.type = togglePassword.checked ? "text" : "password";
    });
    eyeBtn.addEventListener("click", ()=>{
        const nowText = passwordInput.type === "password";
        passwordInput.type = nowText ? "text" : "password";
        togglePassword.checked = nowText;
    });

    /* ── Sign In ── */
    signInBtn.addEventListener("click", async ()=>{
        const enteredValue = passwordInput.value.trim();
        const emailValue   = emailInput.value.trim();

        emailInput.style.borderColor    = "";
        passwordInput.style.borderColor = "";

        if (!emailValue)   emailInput.style.borderColor = "red";
        if (!enteredValue) passwordInput.style.borderColor = "red";
        if (!emailValue || !enteredValue) {
            showNotification("Please enter your credentials.");
            return;
        }
        if (!selectedRole) { showNotification("Please select a role first."); return; }

        setLoading(true);
        try {
            if (selectedRole === "Owner") {
                const res = await fetch("../api/auth.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action:"owner_login", username: emailValue, password: enteredValue })
                });
                const data = await res.json();
                if (data.success) {
                    sessionStorage.setItem("triad_role","owner");
                    sessionStorage.setItem("triad_username", data.username || emailValue);
                    window.location.href = "../owner/owner.html";
                } else {
                    showNotification(data.message || "Incorrect credentials.");
                    passwordInput.style.borderColor = "red";
                    setLoading(false);
                }

            } else {
                if (!/^\d{4}$/.test(enteredValue)) {
                    showNotification("Staff PIN must be exactly 4 digits.");
                    setLoading(false);
                    return;
                }
                const res = await fetch("../api/auth.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action:"staff_login", email: emailValue, pin: enteredValue })
                });
                const data = await res.json();
                if (data.success) {
                    sessionStorage.setItem("triad_role","staff");
                    sessionStorage.setItem("triad_staff_id",   data.staff_id  || "");
                    sessionStorage.setItem("triad_staff_name", data.name      || "Staff");
                    sessionStorage.setItem("triad_staff_email",data.email     || emailValue);
                    sessionStorage.setItem("triad_staff_role", data.position  || "Cashier");
                    window.location.href = "../Staff/staff.html";
                } else {
                    showNotification(data.message || "Invalid email or PIN.");
                    passwordInput.style.borderColor = "red";
                    setLoading(false);
                }
            }
        } catch (err) {
            setLoading(false);
            showNotification("Cannot reach server. Is XAMPP running?");
            console.error("Login error:", err);
        }
    });

    [emailInput, passwordInput].forEach(el=>{
        el.addEventListener("keydown", e=>{ if(e.key==="Enter") signInBtn.click(); });
    });

    overlay.addEventListener("click", e=>{
        if (e.target === overlay) overlay.style.display = "none";
    });
});
