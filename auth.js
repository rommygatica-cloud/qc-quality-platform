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

checkAuth();