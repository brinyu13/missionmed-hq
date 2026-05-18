(function () {
	"use strict";

	var config = window.mmedSessionAdmin || {};
	var root = document.getElementById("mmed-session-manager-root");
	var state = {
		groups: [],
		loading: false,
		editing: null
	};

	if (!root) {
		return;
	}

	function esc(value) {
		return String(value || "").replace(/[&<>"']/g, function (char) {
			return {
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#039;"
			}[char];
		});
	}

	function attr(value) {
		return esc(value).replace(/`/g, "&#096;");
	}

	function baseUrl() {
		return String(config.restUrl || "").replace(/\/$/, "");
	}

	function api(path, options) {
		options = options || {};
		options.credentials = "same-origin";
		options.headers = options.headers || {};
		options.headers["X-WP-Nonce"] = config.nonce || "";

		if (options.body && typeof options.body !== "string") {
			options.headers["Content-Type"] = "application/json";
			options.body = JSON.stringify(options.body);
		}

		return fetch(baseUrl() + path, options).then(function (response) {
			return response.json().then(function (payload) {
				if (!response.ok) {
					throw new Error(payload && payload.message ? payload.message : "Request failed");
				}

				return payload;
			});
		});
	}

	function toast(message, type) {
		var tray = root.querySelector("[data-toast-tray]");
		if (!tray) {
			return;
		}

		var note = document.createElement("div");
		note.className = "mmed-session-toast is-" + (type || "success");
		note.textContent = message;
		tray.appendChild(note);

		window.setTimeout(function () {
			note.classList.add("is-hiding");
			window.setTimeout(function () {
				note.remove();
			}, 250);
		}, 3500);
	}

	function findGroup(id) {
		id = parseInt(id, 10);
		for (var i = 0; i < state.groups.length; i++) {
			if (parseInt(state.groups[i].id, 10) === id) {
				return state.groups[i];
			}
		}
		return null;
	}

	function platformLabel(value) {
		var labels = {
			webex: "Webex",
			zoom: "Zoom",
			google_meet: "Google Meet",
			teams: "Teams"
		};
		return labels[value] || "None";
	}

	function eventTypeLabel(value) {
		var labels = {
			mr_session: "MR Session",
			drill_step1: "Drill Step/Level 1",
			drill_step23: "Drill Step/Level 2/3",
			mock_interview: "Mock Interview",
			study_block: "Study Block",
			general: "General",
			custom: "Custom"
		};
		return labels[value] || value;
	}

	function timeLabel(group) {
		var day = group.day_of_week || "";
		var start = String(group.start_time || "").slice(0, 5);
		var end = String(group.end_time || "").slice(0, 5);
		return [day, start && end ? start + " to " + end : ""].filter(Boolean).join(", ");
	}

	function truncateUrl(url) {
		url = String(url || "");
		if (url.length <= 44) {
			return url;
		}
		return url.slice(0, 28) + "..." + url.slice(-12);
	}

	function optionList(items, selected, labels) {
		return (items || []).map(function (item) {
			var label = labels && labels[item] ? labels[item] : item;
			return '<option value="' + attr(item) + '"' + (item === selected ? " selected" : "") + ">" + esc(label) + "</option>";
		}).join("");
	}

	function instructorOptions(selected) {
		var html = '<option value="0">Unassigned</option>';
		(config.instructors || []).forEach(function (instructor) {
			var value = String(instructor.id);
			html += '<option value="' + attr(value) + '"' + (String(selected || "0") === value ? " selected" : "") + ">" + esc(instructor.name || instructor.email) + "</option>";
		});
		return html;
	}

	function emptyGroup() {
		return {
			id: 0,
			group_slug: "",
			group_name: "",
			description: "",
			instructor_id: 0,
			enrollment_template: "360elite",
			event_type: "mr_session",
			day_of_week: "Wednesday",
			start_time: "20:00:00",
			end_time: "21:30:00",
			meeting_url: "",
			meeting_platform: "webex",
			recurrence_start: "2026-06-03",
			recurrence_end: "2026-12-19",
			is_active: true
		};
	}

	function render() {
		root.innerHTML = [
			'<div class="mmed-session-admin">',
			'<div class="mmed-session-header">',
			'<div>',
			'<p class="mmed-session-eyebrow">MissionMed Matrix Admin</p>',
			'<h1>Live Sessions</h1>',
			'<p>Manage recurring Matrix session groups and push meeting links into student calendars.</p>',
			"</div>",
			'<button type="button" class="button button-primary" data-add-group>Add Session Group</button>',
			"</div>",
			'<div class="mmed-session-card">',
			'<div class="mmed-session-card-head">',
			'<h2>Session Groups</h2>',
			'<button type="button" class="button" data-refresh-groups>Refresh</button>',
			"</div>",
			renderTable(),
			"</div>",
			'<div class="mmed-session-modal-host"></div>',
			'<div class="mmed-session-toast-tray" data-toast-tray></div>',
			"</div>"
		].join("");

		bind();
	}

	function renderTable() {
		if (state.loading) {
			return '<div class="mmed-session-loading"><span class="spinner is-active"></span> Loading session groups...</div>';
		}

		if (!state.groups.length) {
			return '<div class="mmed-session-empty">No session groups found.</div>';
		}

		var rows = state.groups.map(function (group) {
			var url = group.meeting_url || "";
			var statusClass = group.is_active ? "is-active" : "is-inactive";
			return [
				'<tr class="' + statusClass + '">',
				'<td><strong>' + esc(group.group_name) + '</strong><span class="mmed-session-sub">' + esc(group.group_slug) + '</span></td>',
				'<td>' + esc(group.instructor_name || "Unassigned") + '</td>',
				'<td>' + esc(timeLabel(group)) + '<span class="mmed-session-sub">' + esc(eventTypeLabel(group.event_type)) + '</span></td>',
				'<td><span class="mmed-session-platform">' + esc(platformLabel(group.meeting_platform)) + '</span></td>',
				'<td>' + (url ? '<span class="mmed-session-url" title="' + attr(url) + '">' + esc(truncateUrl(url)) + '</span><button type="button" class="button-link mmed-session-copy" data-copy-url="' + attr(url) + '">Copy</button>' : '<span class="description">Not set</span>') + '</td>',
				'<td><button type="button" class="button-link mmed-session-toggle ' + statusClass + '" data-toggle-active="' + group.id + '">' + (group.is_active ? "Active" : "Inactive") + '</button></td>',
				'<td class="mmed-session-actions">',
				'<button type="button" class="button" data-edit-group="' + group.id + '">Edit</button>',
				'<button type="button" class="button" data-propagate-group="' + group.id + '">Propagate</button>',
				"</td>",
				"</tr>"
			].join("");
		}).join("");

		return [
			'<div class="mmed-session-table-wrap">',
			'<table class="widefat striped mmed-session-table">',
			"<thead><tr>",
			"<th>Name</th>",
			"<th>Instructor</th>",
			"<th>Day/Time</th>",
			"<th>Platform</th>",
			"<th>Meeting URL</th>",
			"<th>Status</th>",
			"<th>Actions</th>",
			"</tr></thead>",
			"<tbody>",
			rows,
			"</tbody></table>",
			"</div>"
		].join("");
	}

	function bind() {
		var add = root.querySelector("[data-add-group]");
		var refresh = root.querySelector("[data-refresh-groups]");

		if (add) {
			add.addEventListener("click", function () {
				openModal(emptyGroup());
			});
		}

		if (refresh) {
			refresh.addEventListener("click", loadGroups);
		}

		root.querySelectorAll("[data-edit-group]").forEach(function (button) {
			button.addEventListener("click", function () {
				openModal(findGroup(button.getAttribute("data-edit-group")));
			});
		});

		root.querySelectorAll("[data-toggle-active]").forEach(function (button) {
			button.addEventListener("click", function () {
				toggleActive(button.getAttribute("data-toggle-active"));
			});
		});

		root.querySelectorAll("[data-propagate-group]").forEach(function (button) {
			button.addEventListener("click", function () {
				propagate(button.getAttribute("data-propagate-group"));
			});
		});

		root.querySelectorAll("[data-copy-url]").forEach(function (button) {
			button.addEventListener("click", function () {
				copyText(button.getAttribute("data-copy-url"));
			});
		});
	}

	function loadGroups() {
		state.loading = true;
		render();

		api("", { method: "GET" }).then(function (payload) {
			state.groups = payload && Array.isArray(payload.groups) ? payload.groups : [];
			state.loading = false;
			render();
		}).catch(function (error) {
			state.loading = false;
			render();
			toast(error.message || "Could not load session groups.", "error");
		});
	}

	function openModal(group) {
		group = group || emptyGroup();
		state.editing = group;

		var host = root.querySelector(".mmed-session-modal-host");
		if (!host) {
			return;
		}

		host.innerHTML = [
			'<div class="mmed-session-modal" role="dialog" aria-modal="true">',
			'<div class="mmed-session-backdrop" data-close-modal></div>',
			'<form class="mmed-session-dialog" data-session-form>',
			'<div class="mmed-session-dialog-head">',
			"<h2>" + esc(group.id ? "Edit Session Group" : "Add Session Group") + "</h2>",
			'<button type="button" class="button-link" data-close-modal>Close</button>',
			"</div>",
			'<div class="mmed-session-form-grid">',
			'<label>Group Slug<input name="group_slug" value="' + attr(group.group_slug) + '" required></label>',
			'<label>Group Name<input name="group_name" value="' + attr(group.group_name) + '" required></label>',
			'<label class="mmed-session-span">Description<textarea name="description" rows="3">' + esc(group.description) + "</textarea></label>",
			'<label>Instructor<select name="instructor_id">' + instructorOptions(group.instructor_id) + "</select></label>",
			'<label>Enrollment Template<input name="enrollment_template" value="' + attr(group.enrollment_template || "360elite") + '"></label>',
			'<label>Event Type<select name="event_type">' + optionList(config.eventTypes || [], group.event_type, null) + "</select></label>",
			'<label>Day<select name="day_of_week">' + optionList(config.days || [], group.day_of_week, null) + "</select></label>",
			'<label>Start Time<input name="start_time" type="time" value="' + attr(String(group.start_time || "").slice(0, 5)) + '"></label>',
			'<label>End Time<input name="end_time" type="time" value="' + attr(String(group.end_time || "").slice(0, 5)) + '"></label>',
			'<label>Platform<select name="meeting_platform">' + optionList(config.platforms || [], group.meeting_platform || "webex", {webex:"Webex",zoom:"Zoom",google_meet:"Google Meet",teams:"Teams"}) + "</select></label>",
			'<label class="mmed-session-span">Meeting URL<div class="mmed-session-inline-field"><input name="meeting_url" type="url" value="' + attr(group.meeting_url) + '" placeholder="https://...">' + (group.id ? '<button type="button" class="button" data-modal-propagate="' + group.id + '">Propagate to Students</button>' : "") + "</div></label>",
			'<label>Recurrence Start<input name="recurrence_start" type="date" value="' + attr(group.recurrence_start) + '"></label>',
			'<label>Recurrence End<input name="recurrence_end" type="date" value="' + attr(group.recurrence_end) + '"></label>',
			'<label class="mmed-session-check"><input name="is_active" type="checkbox"' + (group.is_active ? " checked" : "") + "> Active</label>",
			"</div>",
			'<div class="mmed-session-dialog-actions">',
			group.id ? '<button type="button" class="button button-link-delete" data-delete-group="' + group.id + '">Deactivate</button>' : "<span></span>",
			'<div><button type="button" class="button" data-close-modal>Cancel</button> <button type="submit" class="button button-primary">Save Session Group</button></div>',
			"</div>",
			"</form>",
			"</div>"
		].join("");

		host.querySelectorAll("[data-close-modal]").forEach(function (button) {
			button.addEventListener("click", closeModal);
		});

		var form = host.querySelector("[data-session-form]");
		if (form) {
			form.addEventListener("submit", saveGroup);
		}

		var propagateButton = host.querySelector("[data-modal-propagate]");
		if (propagateButton) {
			propagateButton.addEventListener("click", function () {
				propagate(propagateButton.getAttribute("data-modal-propagate"));
			});
		}

		var deleteButton = host.querySelector("[data-delete-group]");
		if (deleteButton) {
			deleteButton.addEventListener("click", function () {
				deactivateGroup(deleteButton.getAttribute("data-delete-group"));
			});
		}
	}

	function closeModal() {
		var host = root.querySelector(".mmed-session-modal-host");
		if (host) {
			host.innerHTML = "";
		}
		state.editing = null;
	}

	function formPayload(form) {
		var data = new FormData(form);
		return {
			group_slug: data.get("group_slug"),
			group_name: data.get("group_name"),
			description: data.get("description"),
			instructor_id: parseInt(data.get("instructor_id") || "0", 10),
			enrollment_template: data.get("enrollment_template"),
			event_type: data.get("event_type"),
			day_of_week: data.get("day_of_week"),
			start_time: data.get("start_time"),
			end_time: data.get("end_time"),
			meeting_url: data.get("meeting_url"),
			meeting_platform: data.get("meeting_platform"),
			recurrence_start: data.get("recurrence_start"),
			recurrence_end: data.get("recurrence_end"),
			is_active: form.querySelector('[name="is_active"]').checked
		};
	}

	function saveGroup(event) {
		event.preventDefault();
		var form = event.currentTarget;
		var group = state.editing || {};
		var id = parseInt(group.id || 0, 10);
		var submit = form.querySelector('[type="submit"]');
		var payload = formPayload(form);

		if (submit) {
			submit.disabled = true;
			submit.textContent = "Saving...";
		}

		api(id ? "/" + id : "", {
			method: id ? "PUT" : "POST",
			body: payload
		}).then(function () {
			toast("Session group saved.");
			closeModal();
			loadGroups();
		}).catch(function (error) {
			toast(error.message || "Could not save session group.", "error");
		}).finally(function () {
			if (submit) {
				submit.disabled = false;
				submit.textContent = "Save Session Group";
			}
		});
	}

	function toggleActive(id) {
		var group = findGroup(id);
		if (!group) {
			return;
		}

		api("/" + id, {
			method: "PUT",
			body: { is_active: !group.is_active }
		}).then(function () {
			toast(group.is_active ? "Session group set inactive." : "Session group set active.");
			loadGroups();
		}).catch(function (error) {
			toast(error.message || "Could not update status.", "error");
		});
	}

	function deactivateGroup(id) {
		api("/" + id, { method: "DELETE" }).then(function () {
			toast("Session group deactivated.");
			closeModal();
			loadGroups();
		}).catch(function (error) {
			toast(error.message || "Could not deactivate session group.", "error");
		});
	}

	function propagate(id) {
		var button = root.querySelector('[data-propagate-group="' + id + '"], [data-modal-propagate="' + id + '"]');
		if (button) {
			button.disabled = true;
			button.textContent = "Propagating...";
		}

		api("/" + id + "/propagate", { method: "POST", body: {} }).then(function (payload) {
			toast("Updated " + parseInt(payload.updated || 0, 10) + " student calendar events.");
			loadGroups();
		}).catch(function (error) {
			toast(error.message || "Could not propagate meeting URL.", "error");
		}).finally(function () {
			if (button) {
				button.disabled = false;
				button.textContent = "Propagate";
			}
		});
	}

	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function () {
				toast("Meeting URL copied.");
			}).catch(function () {
				toast("Copy failed.", "error");
			});
			return;
		}

		toast("Clipboard is not available in this browser.", "error");
	}

	render();
	loadGroups();
})();
