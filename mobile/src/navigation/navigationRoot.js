import { createNavigationContainerRef, CommonActions } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

function dispatchWhenReady(dispatch) {
  let attempts = 0;
  const run = () => {
    if (navigationRef.isReady()) {
      dispatch();
      return;
    }
    attempts += 1;
    if (attempts < 80) setTimeout(run, 25);
  };
  run();
}

export function resetToMain() {
  dispatchWhenReady(() => {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Main" }] }));
  });
}

export function resetToRoleSelection() {
  dispatchWhenReady(() => {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "RoleSelection" }] }));
  });
}

export function resetToLoginRegister(params) {
  dispatchWhenReady(() => {
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "LoginRegister", params: params || undefined }] })
    );
  });
}

export function resetToForcePasswordChange() {
  dispatchWhenReady(() => {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "ForcePasswordChange" }] }));
  });
}

export function resetToProfileSetup() {
  dispatchWhenReady(() => {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "ProfileSetup" }] }));
  });
}

/** After sign-in or password change: choose Main vs forced flows. */
export function resetAfterAuth(user) {
  if (user?.mustChangePassword) resetToForcePasswordChange();
  else if (user?.needsProfileSetup) resetToProfileSetup();
  else resetToMain();
}
