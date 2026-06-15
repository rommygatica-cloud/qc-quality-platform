const SUPABASE_URL = "https://igdafcjpdbwewlcmftdu.supabase.co";
const SUPABASE_KEY = "sb_publishable_SVWL5r4zuVaxFu6b2HWHSg_7huKH3tB";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ROLE_ACCESS = {
  "QC User": ["dashboard", "defects", "tolerances", "specs", "daily", "barcode"],
  "QA User": ["dashboard", "defects", "tolerances", "specs", "qa"],
  "Sourcing User": ["dashboard", "tolerances", "specs", "traceability"],
  "QC Admin": ["dashboard", "defects", "tolerances", "specs", "sops", "daily", "barcode", "traceability", "qa", "admin"],
  "Repack User": ["dashboard", "defects", "tolerances", "specs"]
};

let currentUserRole = null;

async function getUserRole(email) {
  const { data, error } = await supabaseClient
    .from("user_roles")
    .select("*");

  console.log("Roles table:", data);
  console.log("Roles error:", error);

  if (error) {
    console.error(error);
    return null;
  }

  const userRole = data.find(row =>
    row.email?.trim().toLowerCase() === email.trim().toLowerCase()
  );

  return userRole ? userRole.role : "no role found";
}

function applyRoleAccess(role) {
  currentUserRole = role;

  const allowedViews = ROLE_ACCESS[role] || ["dashboard"];

  document.querySelectorAll("[data-view]").forEach(btn => {
    const view = btn.dataset.view;

    if (!allowedViews.includes(view)) {
      btn.style.display = "none";
    } else {
      btn.style.display = "";
    }
  });

  function applyRoleAccess(role) {
  currentUserRole = role;

  const allowedViews = ROLE_ACCESS[role] || ["dashboard"];

  document.querySelectorAll("[data-view]").forEach(btn => {
    const view = btn.dataset.view;

    if (!allowedViews.includes(view)) {
      btn.style.display = "none";
    } else {
      btn.style.display = "";
    }
  });

  const currentActive = document.querySelector(".view.active");

  if (currentActive && !allowedViews.includes(currentActive.id)) {
    show("dashboard");
  }
};

  if (!allowedViews.includes("admin")) {
    const adminMenu = document.getElementById("adminMenu");
    if (adminMenu) adminMenu.style.display = "none";
  }
}

function canAccessView(viewId) {
  const allowedViews = ROLE_ACCESS[currentUserRole] || ["dashboard"];
  return allowedViews.includes(viewId);
}

async function checkAuth() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session) {
    document.body.innerHTML = `
      <div style="
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        flex-direction:column;
        gap:12px;
        font-family:Arial;
      ">
        <h1>Quality Operations Hub</h1>
        <input id="email" placeholder="Email" style="padding:10px;width:280px;">
        <input id="password" type="password" placeholder="Password" style="padding:10px;width:280px;">
        <button onclick="login()" style="padding:12px 20px;">Login</button>
      </div>
    `;
  } else {
    console.log(session.user.email);

    const role = await getUserRole(session.user.email);

    console.log("User role:", role);

    setTimeout(() => applyRoleAccess(role), 300);

    const badge = document.getElementById("userRoleBadge");

    if (badge) {
      badge.innerText =
        `Signed in as ${session.user.email} | Role: ${role}`;
    }

    const btn = document.getElementById("logoutBtn");

    if (btn) {
      btn.addEventListener("click", logout);
    }
  }
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  location.reload();
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

checkAuth();