/**
 * Copyright (c) 2012-2015, Christopher Jeffrey (MIT License)
 * Copyright (c) 2017, Daniel Imms (MIT License)
 *
 * pty.cc:
 *   This file is responsible for starting processes
 *   with pseudo-terminal file descriptors.
 *
 * See:
 *   man pty
 *   man tty_ioctl
 *   man termios
 *   man forkpty
 */

/**
 * Includes
 */

#define NODE_ADDON_API_DISABLE_DEPRECATED
#include <napi.h>
#include <assert.h>
#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <thread>

#include <sys/types.h>
#include <sys/stat.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <signal.h>

/* forkpty */
/* http://www.gnu.org/software/gnulib/manual/html_node/forkpty.html */
#if defined(__linux__)
#include <pty.h>
#elif defined(__APPLE__)
#include <util.h>
#elif defined(__FreeBSD__)
#include <libutil.h>
#endif

/* Some platforms name VWERASE and VDISCARD differently */
#if !defined(VWERASE) && defined(VWERSE)
#define VWERASE	VWERSE
#endif
#if !defined(VDISCARD) && defined(VDISCRD)
#define VDISCARD	VDISCRD
#endif

/**
 * Methods
 */

Napi::Value PtyOpen(const Napi::CallbackInfo& info);
Napi::Value PtyResize(const Napi::CallbackInfo& info);
Napi::Value PtyTakeControl(const Napi::CallbackInfo& info);

/**
 * Functions
 */

static int
pty_nonblock(int);

Napi::Value PtyOpen(const Napi::CallbackInfo& info) {
  Napi::Env env(info.Env());
  Napi::HandleScope scope(env);

  if (info.Length() != 2 ||
      !info[0].IsNumber() ||
      !info[1].IsNumber()) {
    throw Napi::Error::New(env, "Usage: pty.open(cols, rows)");
  }

  // size
  struct winsize winp;
  winp.ws_col = info[0].As<Napi::Number>().Int32Value();
  winp.ws_row = info[1].As<Napi::Number>().Int32Value();
  winp.ws_xpixel = 0;
  winp.ws_ypixel = 0;


  // termios
  struct termios t = termios();
  struct termios *term = &t;
  term->c_iflag = ICRNL | IXON | IXANY | IMAXBEL | BRKINT;
#if defined(IUTF8)
  term->c_iflag |= IUTF8;
#endif
  term->c_oflag = OPOST | ONLCR;
  term->c_cflag = CREAD | CS8 | HUPCL;
  term->c_lflag = ICANON | ISIG | IEXTEN | ECHO | ECHOE | ECHOK | ECHOKE | ECHOCTL;

  term->c_cc[VEOF] = 4;
  term->c_cc[VEOL] = -1;
  term->c_cc[VEOL2] = -1;
  term->c_cc[VERASE] = 0x7f;
  term->c_cc[VWERASE] = 23;
  term->c_cc[VKILL] = 21;
  term->c_cc[VREPRINT] = 18;
  term->c_cc[VINTR] = 3;
  term->c_cc[VQUIT] = 0x1c;
  term->c_cc[VSUSP] = 26;
  term->c_cc[VSTART] = 17;
  term->c_cc[VSTOP] = 19;
  term->c_cc[VLNEXT] = 22;
  term->c_cc[VDISCARD] = 15;
  term->c_cc[VMIN] = 1;
  term->c_cc[VTIME] = 0;

  #if (__APPLE__)
  term->c_cc[VDSUSP] = 25;
  term->c_cc[VSTATUS] = 20;
  #endif

  cfsetispeed(term, B38400);
  cfsetospeed(term, B38400);

  // pty
  int master, slave;
  int ret = openpty(&master, &slave, nullptr, static_cast<termios*>(term), static_cast<winsize*>(&winp));

  if (ret == -1) {
    throw Napi::Error::New(env, "openpty(3) failed.");
  }

  if (pty_nonblock(master) == -1) {
    throw Napi::Error::New(env, "Could not set master fd to nonblocking.");
  }

  if (pty_nonblock(slave) == -1) {
    throw Napi::Error::New(env, "Could not set slave fd to nonblocking.");
  }

  Napi::Object obj = Napi::Object::New(env);  
  obj.Set("master", Napi::Number::New(env, master));  
  obj.Set("slave", Napi::Number::New(env, slave));  
  obj.Set("pty", Napi::String::New(env, ptsname(master)));  

  return obj;
}

Napi::Value PtyResize(const Napi::CallbackInfo& info) {
  Napi::Env env(info.Env());
  Napi::HandleScope scope(env);

  if (info.Length() != 3 ||
      !info[0].IsNumber() ||
      !info[1].IsNumber() ||
      !info[2].IsNumber()) {
    throw Napi::Error::New(env, "Usage: pty.resize(fd, cols, rows)");
  }

  int fd = info[0].As<Napi::Number>().Int32Value();

  struct winsize winp;
  winp.ws_col = info[1].As<Napi::Number>().Int32Value();
  winp.ws_row = info[2].As<Napi::Number>().Int32Value();
  winp.ws_xpixel = 0;
  winp.ws_ypixel = 0;

  if (ioctl(fd, TIOCSWINSZ, &winp) == -1) {
    switch (errno) {
      case EBADF:
        throw Napi::Error::New(env, "ioctl(2) failed, EBADF");
      case EFAULT:
        throw Napi::Error::New(env, "ioctl(2) failed, EFAULT");
      case EINVAL:
        throw Napi::Error::New(env, "ioctl(2) failed, EINVAL");
      case ENOTTY:
        throw Napi::Error::New(env, "ioctl(2) failed, ENOTTY");
    }
    throw Napi::Error::New(env, "ioctl(2) failed");
  }

  return env.Undefined();
}

/**
 * Nonblocking FD
 */

static int
pty_nonblock(int fd) {
  int flags = fcntl(fd, F_GETFL, 0);
  if (flags == -1) return -1;
  return fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

Napi::Value PtyTakeControl(const Napi::CallbackInfo& info) {
  Napi::Env env(info.Env());
  Napi::HandleScope scope(env);

  if (info.Length() != 1 ||
      !info[0].IsNumber()) {
    throw Napi::Error::New(env, "Usage: pty.takeControl(fd)");
  }

  int fd = info[0].As<Napi::Number>().Int32Value();


  if (ioctl(fd, TIOCSCTTY, 0) == -1) {
    switch (errno) {
      case EBADF:
        throw Napi::Error::New(env, "ioctl(2) failed, EBADF");
      case EFAULT:
        throw Napi::Error::New(env, "ioctl(2) failed, EFAULT");
      case EINVAL:
        throw Napi::Error::New(env, "ioctl(2) failed, EINVAL");
      case ENOTTY:
        throw Napi::Error::New(env, "ioctl(2) failed, ENOTTY");
      case EPERM:
        throw Napi::Error::New(env, "ioctl(2) failed, EPERM");
    }
    throw Napi::Error::New(env, "ioctl(2) failed");
  }

  return env.Undefined();
}

/**
 * Init
 */

Napi::Object init(Napi::Env env, Napi::Object exports) {
  exports.Set("open",    Napi::Function::New(env, PtyOpen));
  exports.Set("resize",  Napi::Function::New(env, PtyResize));
  exports.Set("takeControl", Napi::Function::New(env, PtyTakeControl));
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, init)
