// Look Me 锁屏 helper：调用 macOS 私有的 SACLockScreenImmediate 立即锁定屏幕。
//
// 背景：macOS 26 移除了 CGSession 命令行工具
// （/System/Library/CoreServices/Menu Extras/User.menu/...），
// 但 SACLockScreenImmediate 符号仍由 LoginUIKit.framework 导出（旧系统在 login.framework）。
//
// 构建：clang -O2 -arch arm64 -arch x86_64 -o look-me-lock-screen lock-screen.c
// 用法：look-me-lock-screen           立即锁屏
//       look-me-lock-screen --check   只验证符号可解析，不锁屏（冒烟自测用）
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>

typedef void (*LockScreenFn)(void);

static const char *kFrameworks[] = {
    "/System/Library/PrivateFrameworks/LoginUIKit.framework/LoginUIKit",
    "/System/Library/PrivateFrameworks/login.framework/login",
};

int main(int argc, char **argv) {
  void *handle = NULL;
  for (size_t i = 0; i < sizeof(kFrameworks) / sizeof(kFrameworks[0]); i += 1) {
    handle = dlopen(kFrameworks[i], RTLD_LAZY);
    if (handle != NULL) {
      break;
    }
  }
  if (handle == NULL) {
    fprintf(stderr, "lock-screen: no usable framework found\n");
    return 2;
  }

  LockScreenFn lockScreen = (LockScreenFn)dlsym(handle, "SACLockScreenImmediate");
  if (lockScreen == NULL) {
    fprintf(stderr, "lock-screen: SACLockScreenImmediate not found\n");
    return 3;
  }

  if (argc > 1 && strcmp(argv[1], "--check") == 0) {
    printf("lock-screen: ok\n");
    return 0;
  }

  lockScreen();
  return 0;
}
