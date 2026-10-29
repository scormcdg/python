/*
 * Communication avec Moodle (SCORM 2004).
 * Hors Moodle (fichier ouvert directement), la progression est gardée
 * dans le navigateur (localStorage) pour pouvoir tester le paquetage.
 */
(function (global) {
  "use strict";

  var api = null;
  var started = false;
  var finished = false;
  var startTime = Date.now();
  var storageKey = "scorm-proto";

  function findAPI(win) {
    var tries = 0;
    while (win && tries < 12) {
      try {
        if (win.API_1484_11) return win.API_1484_11;
      } catch (e) { /* cadre d'un autre domaine */ }
      if (win.parent === win) break;
      win = win.parent;
      tries++;
    }
    return null;
  }

  function get(k) {
    return api ? api.GetValue(k) : "";
  }

  function set(k, v) {
    if (!api) return true;
    var ok = api.SetValue(k, String(v));
    if (ok !== "true" && ok !== true) {
      var code = api.GetLastError();
      console.warn("SCORM SetValue(" + k + ") a échoué : " + code + " " + api.GetErrorString(code));
      return false;
    }
    return true;
  }

  function commit() {
    if (api && started && !finished) api.Commit("");
  }

  /* Durée ISO 8601 exigée par SCORM 2004, ex. PT1H5M12S */
  function isoDuration(ms) {
    var s = Math.round(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return "PT" + h + "H" + m + "M" + sec + "S";
  }

  /* Horodatage SCORM 2004 : AAAA-MM-JJThh:mm:ss */
  function timestamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  var Scorm = {
    /* Démarre la session. Renvoie l'état sauvegardé (ou null). */
    start: function (key) {
      storageKey = "scorm-proto-" + key;
      api = findAPI(global) || (global.opener && findAPI(global.opener));
      if (api) {
        var r = api.Initialize("");
        started = r === "true" || r === true;
        var st = get("cmi.completion_status");
        if (st === "unknown" || st === "not attempted" || st === "") set("cmi.completion_status", "incomplete");
        set("cmi.exit", "suspend");
        var raw = get("cmi.suspend_data");
        try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
      }
      started = true;
      try {
        var saved = global.localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : null;
      } catch (e) { return null; }
    },

    connected: function () { return !!api; },

    /* Sauvegarde l'état (code des élèves, exercices validés…). */
    save: function (state, location) {
      var json = JSON.stringify(state);
      if (api) {
        if (json.length > 64000) console.warn("suspend_data trop volumineux (" + json.length + " caractères)");
        set("cmi.suspend_data", json);
        if (location) set("cmi.location", location);
      } else {
        try { global.localStorage.setItem(storageKey, json); } catch (e) { /* stockage indisponible */ }
      }
    },

    /* Note sur 100 et statuts. */
    setResult: function (score, complete) {
      set("cmi.score.min", 0);
      set("cmi.score.max", 100);
      set("cmi.score.raw", score);
      set("cmi.score.scaled", (score / 100).toFixed(4));
      set("cmi.completion_status", complete ? "completed" : "incomplete");
      set("cmi.success_status", complete ? "passed" : "unknown");
    },

    /* Une vérification = une ligne dans le rapport « Interactions » de Moodle. */
    recordInteraction: function (o) {
      if (!api) return;
      var n = parseInt(get("cmi.interactions._count"), 10) || 0;
      var p = "cmi.interactions." + n + ".";
      set(p + "id", o.id);
      set(p + "type", "other");
      set(p + "timestamp", timestamp());
      if (o.description) set(p + "description", o.description.slice(0, 250));
      set(p + "learner_response", (o.response || "").slice(0, 3000));
      set(p + "result", o.correct ? "correct" : "incorrect");
    },

    commit: commit,

    finish: function () {
      if (!api || finished) return;
      set("cmi.session_time", isoDuration(Date.now() - startTime));
      set("cmi.exit", "suspend");
      api.Commit("");
      api.Terminate("");
      finished = true;
    }
  };

  global.Scorm = Scorm;
})(typeof window !== "undefined" ? window : globalThis);
