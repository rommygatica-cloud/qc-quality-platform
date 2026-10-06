const SUPABASE_URL = "https://igdafcjpdbwewlcmftdu.supabase.co";
const SUPABASE_KEY = "sb_publishable_SVWL5r4zuVaxFu6b2HWHSg_7huKH3tB";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/*
|--------------------------------------------------------------------------
| Legacy Role Access
|--------------------------------------------------------------------------
| Controls which main sections of the Hub a role can see.
| Individual permissions are handled separately below.
*/

const ROLE_ACCESS = {
  "QC User": [
    "dashboard",
    "defects",
    "tolerances",
    "specs",
    "daily",
    "barcode"
  ],

  "QA User": [
    "dashboard",
    "defects",
    "tolerances",
    "specs",
    "qa"
  ],

  "Sourcing User": [
    "dashboard",
    "tolerances",
    "specs",
    "traceability"
  ],

  "QC Admin": [
    "dashboard",
    "defects",
    "tolerances",
    "specs",
    "sops",
    "daily",
    "barcode",
    "traceability",
    "qa",
    "admin"
  ],

  "Repack User": [
    "dashboard",
    "defects",
    "tolerances",
    "specs"
  ]
};


let currentUserRole = null;
let currentUserRoleId = null;
let currentUserPermissions = {};


/*
|--------------------------------------------------------------------------
| Get User Role
|--------------------------------------------------------------------------
*/

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
    row.email?.trim().toLowerCase() ===
    email.trim().toLowerCase()
  );

  if (userRole) {
    currentUserRoleId = userRole.id;
  }

  return userRole ? userRole.role : "no role found";
}


/*
|--------------------------------------------------------------------------
| Load Effective Permissions
|--------------------------------------------------------------------------
| Reads:
| 1. Role template permissions
| 2. Individual user overrides
|
| Result:
| currentUserPermissions = {
|   "arrivals.view": true,
|   "arrivals.edit_status": false,
|   ...
| }
*/

async function loadUserPermissions(userRoleId) {

  if (!userRoleId) {
    console.warn("No user role ID available.");
    currentUserPermissions = {};
    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Get user's role template
  |--------------------------------------------------------------------------
  */

  const { data: userRole, error: userRoleError } =
    await supabaseClient
      .from("user_roles")
      .select("role_template_id")
      .eq("id", userRoleId)
      .single();

  if (userRoleError || !userRole) {
    console.error(
      "Unable to load role template:",
      userRoleError
    );

    currentUserPermissions = {};
    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Get template permissions
  |--------------------------------------------------------------------------
  */

  const { data: templatePermissions, error: templateError } =
    await supabaseClient
      .from("role_template_permissions")
      .select(`
        permission_key,
        is_allowed
      `)
      .eq(
        "role_template_id",
        userRole.role_template_id
      );


  if (templateError) {
    console.error(
      "Template permissions error:",
      templateError
    );

    currentUserPermissions = {};
    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Get individual overrides
  |--------------------------------------------------------------------------
  */

  const { data: overrides, error: overridesError } =
    await supabaseClient
      .from("user_permissions")
      .select(`
        permission_key,
        is_allowed
      `)
      .eq(
        "user_role_id",
        userRoleId
      );


  if (overridesError) {
    console.error(
      "User permissions error:",
      overridesError
    );

    currentUserPermissions = {};
    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Build effective permissions
  |--------------------------------------------------------------------------
  */

  const permissions = {};


  /*
  | Start with role template
  */

  (templatePermissions || []).forEach(permission => {

    permissions[permission.permission_key] =
      permission.is_allowed === true;

  });


  /*
  | Apply individual overrides
  */

  (overrides || []).forEach(permission => {

    permissions[permission.permission_key] =
      permission.is_allowed === true;

  });


  currentUserPermissions = permissions;


  console.log(
    "Effective user permissions:",
    currentUserPermissions
  );
}


/*
|--------------------------------------------------------------------------
| Permission Check
|--------------------------------------------------------------------------
*/

function hasPermission(permissionKey) {
  return currentUserPermissions[permissionKey] === true;
}

/*
|--------------------------------------------------------------------------
| Apply Main View Access
|--------------------------------------------------------------------------
*/

function applyRoleAccess(role) {

  currentUserRole = role;

  const allowedViews =
    ROLE_ACCESS[role] || ["dashboard"];


  document
    .querySelectorAll("[data-view]")
    .forEach(btn => {

      const view = btn.dataset.view;

      if (!allowedViews.includes(view)) {

        btn.style.display = "none";

      } else {

        btn.style.display = "";

      }

    });


  /*
  |--------------------------------------------------------------------------
  | Hide Administration unless role has access
  |--------------------------------------------------------------------------
  */

  if (!allowedViews.includes("admin")) {

    const adminMenu =
      document.getElementById("adminMenu");

    if (adminMenu) {
      adminMenu.style.display = "none";
    }

  }


  /*
  |--------------------------------------------------------------------------
  | If current view is no longer allowed,
  | return to Dashboard.
  |--------------------------------------------------------------------------
  */

  const currentActive =
    document.querySelector(".view.active");


  if (
    currentActive &&
    !allowedViews.includes(currentActive.id)
  ) {

    if (
      typeof show === "function" &&
      allowedViews.includes("dashboard")
    ) {

      show("dashboard");

    }

  }
}


/*
|--------------------------------------------------------------------------
| Check Main View Access
|--------------------------------------------------------------------------
*/

function canAccessView(viewId) {

  const allowedViews =
    ROLE_ACCESS[currentUserRole] ||
    ["dashboard"];

  return allowedViews.includes(viewId);
}


/*
|--------------------------------------------------------------------------
| Apply Permission-Based UI
|--------------------------------------------------------------------------
|
| Any element can use:
|
| data-permission="arrivals.edit_status"
|
| and it will automatically be hidden if the user
| does not have that permission.
|
*/

function applyPermissionAccess() {

  document
    .querySelectorAll("[data-permission]")
    .forEach(element => {

      const permission =
        element.dataset.permission;

      if (!hasPermission(permission)) {

        element.style.display = "none";

      } else {

        element.style.display = "";

      }

    });
}
let isPasswordRecovery = false;
const initialAuthHash = window.location.hash;
const inviteFromUrl =
  new URLSearchParams(initialAuthHash.substring(1)).get("type") === "invite";

if (inviteFromUrl) {
  sessionStorage.setItem("qc_invitation_flow", "true");
}

const isInvitationFlow =
  inviteFromUrl ||
  sessionStorage.getItem("qc_invitation_flow") === "true";

console.log("📨 INVITATION FLOW:", isInvitationFlow);

supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("🔎 AUTH EVENT:", event, session?.user?.email);
      if (isInvitationFlow) {
    console.log("🎯 INVITED USER DETECTED:", session?.user?.email);
    showInvitationPasswordScreen();
    return;
  }
  if (event === "PASSWORD_RECOVERY") {
    isPasswordRecovery = true;
    console.log("🔐 PASSWORD RECOVERY MODE");
    showPasswordRecoveryScreen();
  }
});

function showInvitationPasswordScreen() {

  console.log("👤 SHOW INVITATION PASSWORD SCREEN");
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
      <h1>Welcome to QC Hub</h1>
      <p>Set your password to activate your account.</p>
      <input
  id="invitationPassword"
  type="password"
  placeholder="Create Password"
  style="padding:10px;width:280px;"
>

<input
  id="confirmInvitationPassword"
  type="password"
  placeholder="Confirm Password"
  style="padding:10px;width:280px;"
>

<button
  id="activateAccountBtn"
  style="padding:12px 20px;"
>
  Activate Account
</button>
    </div>
  `;
  document.getElementById("activateAccountBtn").onclick = async () => {

  const password =
    document.getElementById("invitationPassword").value;

  const confirmPassword =
    document.getElementById("confirmInvitationPassword").value;

  if (!password || !confirmPassword) {
    alert("Please enter and confirm your password.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match.");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
  password: password
});

if (error) {
  alert(error.message);
  return;
}

console.log("✅ INVITATION PASSWORD CREATED");
alert("Account activated successfully!");
sessionStorage.removeItem("qc_invitation_flow");

await supabaseClient.auth.signOut();

location.href = window.location.origin;
};
}

function showPasswordRecoveryScreen() {

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

      <h1>Reset Password</h1>

      <input
        id="newPassword"
        type="password"
        placeholder="New Password"
        style="padding:10px;width:280px;"
      >

      <input
        id="confirmNewPassword"
        type="password"
        placeholder="Confirm New Password"
        style="padding:10px;width:280px;"
      >

      <label style="
      display:flex;
      align-items:center;
      gap:6px;
      width:280px;
      font-size:14px;
      cursor:pointer;
      ">
      <input
      id="showRecoveryPasswords"
      type="checkbox"
      >
      Show passwords
      </label>

      <button
        id="updatePasswordBtn"
        style="padding:12px 20px;"
      >
        Update Password
      </button>

    </div>
  `;

document.getElementById("showRecoveryPasswords").onchange = function () {

  const inputType = this.checked ? "text" : "password";

  document.getElementById("newPassword").type = inputType;
  document.getElementById("confirmNewPassword").type = inputType;
};

    document.getElementById("updatePasswordBtn").onclick = async () => {

    const newPassword =
      document.getElementById("newPassword").value;

    const confirmPassword =
      document.getElementById("confirmNewPassword").value;

    if (!newPassword || !confirmPassword) {
      alert("Please enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const { error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully.");

await supabaseClient.auth.signOut();

location.href = window.location.origin;
  };

}

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

async function checkAuth() {

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();


  /*
  |--------------------------------------------------------------------------
  | No Session
  |--------------------------------------------------------------------------
  */

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

        <input
          id="email"
          placeholder="Email"
          style="padding:10px;width:280px;"
        >

        <input
          id="password"
          type="password"
          placeholder="Password"
          style="padding:10px;width:280px;"
        >

        <button
          onclick="login()"
          style="padding:12px 20px;"
        >
          Login
        </button>

       <button
  onclick="forgotPassword()"
  style="
    border:none;
    background:none;
    cursor:pointer;
    text-decoration:underline;
  "
>
  Forgot password?
</button> 

      </div>
    `;

    return;
  }


  /*
  |--------------------------------------------------------------------------
  | Logged In
  |--------------------------------------------------------------------------
  */

  console.log(
    "Signed in:",
    session.user.email
  );


  const role =
    await getUserRole(session.user.email);


  console.log(
    "User role:",
    role
  );


  /*
  |--------------------------------------------------------------------------
  | Load permissions BEFORE applying UI access
  |--------------------------------------------------------------------------
  */

  await loadUserPermissions(
    currentUserRoleId
  );


  /*
  |--------------------------------------------------------------------------
  | Apply access
  |--------------------------------------------------------------------------
  */

  setTimeout(() => {

    applyRoleAccess(role);

    applyPermissionAccess();

  }, 300);


  /*
  |--------------------------------------------------------------------------
  | User Badge
  |--------------------------------------------------------------------------
  */

  const badge =
    document.getElementById(
      "userRoleBadge"
    );


  if (badge) {

    badge.innerText =
      `Signed in as ${session.user.email} | Role: ${role}`;

  }


  /*
  |--------------------------------------------------------------------------
  | Logout
  |--------------------------------------------------------------------------
  */

  const btn =
    document.getElementById(
      "logoutBtn"
    );


  if (btn) {

    btn.addEventListener(
      "click",
      logout
    );

  }

}


/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

async function login() {

  const email =
    document.getElementById(
      "email"
    ).value;


  const password =
    document.getElementById(
      "password"
    ).value;


  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });


  if (error) {

    alert(error.message);

    return;
  }


  location.reload();
}

async function forgotPassword() {

  const email =
    document.getElementById("email")?.value.trim();

  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  const { error } =
    await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Password reset email sent. Please check your inbox.");
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

async function logout() {

  await supabaseClient.auth.signOut();

  location.reload();
}


/*
|--------------------------------------------------------------------------
| Start Authentication
|--------------------------------------------------------------------------
*/

if (!isInvitationFlow) {
  checkAuth();
}