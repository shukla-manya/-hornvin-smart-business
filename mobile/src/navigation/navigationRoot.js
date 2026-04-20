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

export function resetToForcePasswordChange() {
  dispatchWhenReady(() => {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "ForcePasswordChange" }] }));
  });
}
