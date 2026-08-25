(function () {
  "use strict";

  var body = document.body;
  var action = document.getElementById("primary-action");
  var cat = document.getElementById("cat");
  var eyeMeter = document.getElementById("eye-meter");
  var gazeProgress = document.getElementById("gaze-progress");
  var stageNumber = document.getElementById("stage-number");
  var kicker = document.getElementById("stage-kicker");
  var title = document.getElementById("stage-title");
  var copy = document.getElementById("stage-copy");
  var hint = document.getElementById("stage-hint");
  var timerValue = document.getElementById("timer-value");
  var progressItems = document.querySelectorAll(".stage-dots li");
  var blinkCount = 0;
  var timerId = null;
  var stageDelayId = null;

  var stageContent = {
    welcome: {
      number: "00",
      kicker: "无摄像头 · 站内引导",
      title: "让眼睛离开屏幕 25 秒",
      copy: "和 Lumi 完成眨眼、远眺和起身。",
      hint: "不用摄像头，按按钮完成这一轮。",
      action: "和 Lumi 休息 25 秒"
    },
    blink: {
      number: "01",
      kicker: "第一站 · 慢眨眼",
      title: "慢慢眨两下",
      copy: "闭上，再放松睁开。每次眨完点一下。",
      hint: "Lumi 帮你数到 2。",
      action: "我眨了一下"
    },
    horizon: {
      number: "02",
      kicker: "第二站 · 远眺",
      title: "看向窗外最远处",
      copy: "看向远处 20 秒，不用盯着倒计时。",
      hint: "20 秒后我再提醒你。",
      action: "远眺中 · 20 秒"
    },
    stretch: {
      number: "03",
      kicker: "第三站 · 起身",
      title: "站起来，伸个懒腰",
      copy: "肩膀往后，走两步。回来再点完成。",
      hint: "Lumi 在这里等你，不着急。",
      action: "我动了一下"
    },
    done: {
      number: "✓",
      kicker: "本轮完成",
      title: "这一轮完成了",
      copy: "2 次慢眨 · 20 秒远眺 · 1 次起身",
      hint: "下次盯屏太久，再回来陪 Lumi 一轮。",
      action: "再来一轮"
    }
  };

  var stageOrder = ["blink", "horizon", "stretch"];

  function updateProgress(stage) {
    var activeIndex = stageOrder.indexOf(stage);
    var doneCount = stage === "done" ? stageOrder.length : activeIndex;

    progressItems.forEach(function (item, index) {
      item.classList.toggle("is-active", index === activeIndex);
      item.classList.toggle("is-done", index < doneCount || stage === "done");
    });
  }

  function clearTimers() {
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }

    if (stageDelayId !== null) {
      window.clearTimeout(stageDelayId);
      stageDelayId = null;
    }
  }

  function renderStage(stage) {
    var content = stageContent[stage];

    clearTimers();
    body.dataset.stage = stage;
    stageNumber.textContent = content.number;
    kicker.textContent = content.kicker;
    title.textContent = content.title;
    copy.textContent = content.copy;
    hint.textContent = content.hint;
    action.textContent = content.action;
    action.disabled = false;
    gazeProgress.style.width = stage === "done" ? "100%" : "0%";
    updateProgress(stage);

    if (stage === "welcome") {
      blinkCount = 0;
      body.dataset.blinks = "0";
      eyeMeter.setAttribute("aria-label", "异瞳眨眼进度：0 次，共 2 次");
    }

    if (stage === "horizon") {
      startHorizonTimer();
    }
  }

  function showCatBlink() {
    cat.classList.remove("is-blinking");
    cat.src = "./assets/cat-blink.png";
    void cat.offsetWidth;
    cat.classList.add("is-blinking");

    window.setTimeout(function () {
      cat.src = "./assets/cat-idle.png";
      cat.classList.remove("is-blinking");
    }, 260);
  }

  function recordBlink() {
    if (blinkCount >= 2) {
      return;
    }

    blinkCount += 1;
    body.dataset.blinks = String(blinkCount);
    eyeMeter.setAttribute(
      "aria-label",
      "异瞳眨眼进度：" + blinkCount + " 次，共 2 次"
    );
    showCatBlink();

    if (blinkCount === 1) {
      hint.textContent = "很好，再慢慢眨一次。";
      action.textContent = "再眨一下";
      return;
    }

    hint.textContent = "两下完成。接下来看看远处。";
    action.textContent = "很好，去看远处";
    action.disabled = true;
    stageDelayId = window.setTimeout(function () {
      renderStage("horizon");
    }, 700);
  }

  function startHorizonTimer() {
    var duration = 20000;
    var deadline = Date.now() + duration;

    action.disabled = true;
    timerValue.textContent = "20";

    function updateTimer() {
      var remaining = Math.max(0, deadline - Date.now());
      var seconds = Math.ceil(remaining / 1000);
      var progress = Math.min(100, ((duration - remaining) / duration) * 100);

      timerValue.textContent = String(seconds);
      action.textContent = "远眺中 · " + seconds + " 秒";
      gazeProgress.style.width = progress + "%";

      if (remaining === 0) {
        window.clearInterval(timerId);
        timerId = null;
        action.textContent = "远眺完成";
        stageDelayId = window.setTimeout(function () {
          renderStage("stretch");
        }, 450);
      }
    }

    updateTimer();
    timerId = window.setInterval(updateTimer, 250);
  }

  action.addEventListener("click", function () {
    var stage = body.dataset.stage;

    if (stage === "welcome") {
      renderStage("blink");
      return;
    }

    if (stage === "blink") {
      recordBlink();
      return;
    }

    if (stage === "stretch") {
      renderStage("done");
      return;
    }

    if (stage === "done") {
      renderStage("welcome");
    }
  });

  renderStage("welcome");
})();
