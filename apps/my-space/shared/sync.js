/* ============================================
   SYNC.JS — Dual-mode Data Layer
   Shared by Schedule + Admin Tracker
   ============================================
   Cloud mode:  User is logged in via Supabase (not sandbox)
   Sandbox mode: localStorage only
   
   Exports (on window.Sync):
     isCloudMode()
     syncToCloud(userId)
     loadFromCloud(userId)
     setSyncBadge(state)

     cloudLoadScheduleEvents(userId)
     cloudSaveScheduleEvents(userId, events)
     cloudLoadRedDays(userId)
     cloudSaveRedDays(userId, redDays)
     cloudLoadClassAdmin(userId)
     cloudSaveClassAdmin(userId, data)
     cloudLoadClassUnits(userId)
     cloudSaveClassUnits(userId, data)

     cloudLoadTasks(userId)
     cloudSaveTasks(userId, tasks)
     cloudLoadTaskCategories(userId)
     cloudSaveTaskCategories(userId, categories)
   ============================================ */

(function () {
  'use strict';

  // ── Sync badge state ─────────────────────────────────────────────
  const BADGE_STATES = {
    synced: { icon: 'cloud', text: 'Synced', cls: 'bg-green/10 text-green  border-green/30' },
    syncing: { icon: 'loader', text: 'Syncing…', cls: 'bg-orange/10 text-orange border-orange/30 animate-pulse' },
    local: { icon: 'hard-drive', text: 'Local', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-[var(--border-primary)]' },
    error: { icon: 'alert-triangle', text: 'Sync Error', cls: 'bg-pink/10 text-pink border-pink/30' },
  };

  function setSyncBadge(state) {
    const badge = document.getElementById('sync-badge');
    if (!badge) return;
    const s = BADGE_STATES[state] || BADGE_STATES.local;
    badge.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] text-xs font-extrabold uppercase tracking-widest ${s.cls}`;
    badge.innerHTML = `<i data-lucide="${s.icon}" class="w-3 h-3"></i> ${s.text}`;
    if (window.lucide) lucide.createIcons({ root: badge });
  }

  // ── Mode detection ───────────────────────────────────────────────
  function isCloudMode() {
    return !isSandbox(); // isSandbox() is global from supabase.js
  }

  // ── Column-mapping helpers ───────────────────────────────────────
  function isPromoted(evt) {
    if (!evt.isRecurrence) return false;
    
    // 1. Date/Time changes
    if (evt.originalDate && evt.date !== evt.originalDate) return true;
    if (evt.originalStartTime && evt.startTime !== evt.originalStartTime) return true;
    if (evt.originalEndTime && evt.endTime !== evt.originalEndTime) return true;

    // 2. Content changes
    if (evt.notes && evt.notes.trim() !== '') return true;
    if (evt.overrideType && evt.overrideType.trim() !== '') return true;
    if (evt.coveredBy && evt.coveredBy.trim() !== '') return true;
    
    // 3. Room change (if we have originalRoom)
    if (evt.originalRoom !== undefined && evt.room !== evt.originalRoom) return true;

    // 4. Name/Color change (if we have originalName/originalColor)
    if (evt.originalName !== undefined && evt.name !== evt.originalName) return true;
    if (evt.originalColor !== undefined && evt.color !== evt.originalColor) return true;

    // 5. Checklist activity
    if (evt.checklist && evt.checklist.some(item => item.done)) return true;

    return false;
  }

  // schedule_events: JS → SQL
  function sanitiseForCloud(evt, userId) {
    // Guard: Skip recurrence clones that haven't been modified (promoted)
    if (evt.id.includes('_recur_') && !isPromoted(evt)) return null;

    return {
      id: evt.id,
      user_id: userId,
      name: evt.name,
      type_id: evt.typeId,
      color: evt.color,
      date: evt.date,
      start_time: evt.startTime,
      end_time: evt.endTime,
      room: evt.room || '',
      notes: evt.notes || '',
      recurrence: evt.recurrence || 'none',
      recurrence_days: evt.recurrenceDays || [],
      checklist: evt.checklist || [],
      override_type: evt.overrideType || null,
      covered_by: evt.coveredBy || null,
      graduation_class: !!evt.graduationClass,
      graduation_date: evt.graduationDate || null,
      is_master: !evt.isRecurrence,
      master_event_id: evt.isRecurrence ? (evt.originalEventId || null) : null,
      created_at: evt.createdAt || new Date().toISOString(),
      updated_at: evt.updatedAt || new Date().toISOString(),
    };
  }

  // schedule_events: SQL → JS
  function rowToEvent(row) {
    return {
      id: row.id,
      name: row.name,
      typeId: row.type_id,
      color: row.color,
      date: row.date,
      startTime: row.start_time,
      endTime: row.end_time,
      room: row.room || '',
      notes: row.notes || '',
      recurrence: row.recurrence || 'none',
      recurrenceDays: row.recurrence_days || [],
      checklist: row.checklist || [],
      overrideType: row.override_type || null,
      coveredBy: row.covered_by || '',
      graduationClass: !!row.graduation_class,
      graduationDate: row.graduation_date || '',
      isRecurrence: !row.is_master,
      originalEventId: row.master_event_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: strip recurrence clones — only master events go to cloud
  function mastersOnly(events) {
    return events.filter(e => !e.isRecurrence);
  }

  // myspace_settings: JS → SQL
  function settingsToRow(userId, settings) {
    const row = { user_id: userId };
    if (settings.dates !== undefined) row.dates = settings.dates;
    if (settings.schedule !== undefined) row.schedule = settings.schedule;
    if (settings.admin_tracker !== undefined) row.admin_tracker = settings.admin_tracker;
    if (settings.task !== undefined) row.task = settings.task;
    if (settings.class !== undefined) row.class = settings.class;
    return row;
  }

  // myspace_class_admin: JS → SQL
  // localStorage shape: { "ClassName": [ {id, text, done, deadline}, ... ] }
  // Supabase shape: one row per class with tasks JSON array
  function classAdminToRow(className, tasks, userId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanTasks = tasks.map(task => {
      let finalId = task.id;
      if (!finalId || !uuidRegex.test(finalId)) {
        finalId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');
      }
      return {
        id: finalId,
        text: task.text,
        done: !!task.done,
        deadline: task.deadline || null
      };
    });
    return {
      user_id: userId,
      class_name: className,
      tasks: cleanTasks,
    };
  }

  // myspace_class_units: JS → SQL
  // localStorage shape: { "ClassName": [ {index, unit, lesson, is_completed}, ... ] }
  // Supabase shape: one row per class with syllabus JSON array
  function classSyllabusToRow(className, syllabus, userId) {
    return {
      user_id: userId,
      class_name: className,
      syllabus: syllabus || [],
    };
  }

  // ── Per-table Cloud CRUD ─────────────────────────────────────────

  // Events
  async function cloudLoadScheduleEvents(userId) {
    const [mastersRes, promotedRes] = await Promise.all([
      db.from('myspace_events').select('*').eq('user_id', userId).eq('is_master', true),
      db.from('myspace_events').select('*').eq('user_id', userId).eq('is_master', false)
    ]);

    if (mastersRes.error) console.error('[Sync] Load masters error:', mastersRes.error);
    if (promotedRes.error) console.error('[Sync] Load promoted error:', promotedRes.error);

    return {
      masters: (mastersRes.data || []).map(rowToEvent),
      promoted: (promotedRes.data || []).map(rowToEvent)
    };
  }

  async function cloudSaveScheduleEvents(userId, events) {
    // Build rows, filter nulls, upsert all
    const rows = events.map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
    if (rows.length === 0) return;
    const { error } = await db.from('myspace_events')
      .upsert(rows, { onConflict: 'id' });
    if (error) console.error('[Sync] Save events error:', error);
  }

  async function cloudDeleteScheduleEvent(userId, eventId, isMaster = false) {
    let query = db.from('myspace_events').delete().eq('user_id', userId);
    if (isMaster) {
      // Delete master and all its recurrence clones
      query = query.or(`id.eq.${eventId},master_event_id.eq.${eventId}`);
    } else {
      query = query.eq('id', eventId);
    }
    const { error } = await query;
    if (error) console.error('[Sync] Delete event error:', error);
  }

  async function cloudReplaceAllScheduleEvents(userId, events) {
    // Delete all then insert fresh (for full sync)
    await db.from('myspace_events').delete().eq('user_id', userId);
    const rows = events.map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
    if (rows.length > 0) {
      const { error } = await db.from('myspace_events').insert(rows);
      if (error) console.error('[Sync] Replace events error:', error);
    }
  }

  // Settings (Red Days, UI Preferences)
  async function cloudLoadSettings(userId) {
    const { data, error } = await db.from('myspace_settings')
      .select('dates, schedule, admin_tracker, task, class')
      .eq('user_id', userId).maybeSingle();
    if (error) { console.error('[Sync] Load settings error:', error); return null; }
    return data || { dates: [], schedule: {}, admin_tracker: {}, task: {}, class: {} };
  }

  async function cloudSaveSettings(userId, newSettings) {
    // 1. Fetch current to avoid overwriting other tool settings
    const current = await cloudLoadSettings(userId);
    const merged = {
      dates: newSettings.dates !== undefined ? newSettings.dates : (current?.dates || []),
      schedule: { ...(current?.schedule || {}), ...(newSettings.schedule || {}) },
      admin_tracker: { ...(current?.admin_tracker || {}), ...(newSettings.admin_tracker || {}) },
      task: { ...(current?.task || {}), ...(newSettings.task || {}) },
      class: { ...(current?.class || {}), ...(newSettings.class || {}) },
    };

    const row = settingsToRow(userId, merged);
    console.log('[Sync] Saving settings to cloud:', row);
    const { error } = await db.from('myspace_settings')
      .upsert(row, { onConflict: 'user_id' });
    if (error) {
      console.error('[Sync] Save settings error:', error);
      throw error; 
    }
  }

  // Class Admin
  async function cloudLoadClassAdmin(userId) {
    const { data, error } = await db.from('myspace_class_admin')
      .select('class_name, tasks').eq('user_id', userId);
    if (error) { console.error('[Sync] Load class admin error:', error); return null; }
    const result = {};
    (data || []).forEach(row => {
      result[row.class_name] = row.tasks || [];
    });
    return result;
  }

  async function cloudSaveClassAdmin(userId, adminData) {
    const { data: existing, error: fetchErr } = await db.from('myspace_class_admin').select('id, class_name').eq('user_id', userId);
    if (fetchErr) {
      console.error('[Sync] Fetch class admin error:', fetchErr);
      return;
    }

    const existingMap = {};
    (existing || []).forEach(row => {
      existingMap[row.class_name] = row.id;
    });

    const rowsToUpsert = [];
    Object.entries(adminData).forEach(([className, tasks]) => {
      if (Array.isArray(tasks)) {
        const row = classAdminToRow(className, tasks, userId);
        // Always ensure id is set — use existing DB id or generate a new UUID
        row.id = existingMap[className] || (
          (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
        );
        rowsToUpsert.push(row);
      }
    });

    if (rowsToUpsert.length > 0) {
      const { error } = await db.from('myspace_class_admin').upsert(rowsToUpsert, { onConflict: 'id' });
      if (error) console.error('[Sync] Upsert class admin error:', error);
    }
  }

  // Class Syllabus (formerly myspace_class_units)
  async function cloudLoadClassUnits(userId) {
    const { data, error } = await db.from('myspace_class_units')
      .select('class_name, syllabus').eq('user_id', userId);
    if (error) { console.error('[Sync] Load class syllabus error:', error); return null; }
    const result = {};
    (data || []).forEach(row => {
      result[row.class_name] = row.syllabus || [];
    });
    return result;
  }

  async function cloudSaveClassUnits(userId, syllabusData) {
    // Fetch existing rows to get their IDs
    const { data: existing, error: fetchErr } = await db.from('myspace_class_units').select('id, class_name').eq('user_id', userId);
    if (fetchErr) {
      console.error('[Sync] Fetch class syllabus error:', fetchErr);
      return;
    }

    const existingMap = {};
    (existing || []).forEach(row => {
      existingMap[row.class_name] = row.id;
    });

    const rowsToUpsert = [];
    Object.entries(syllabusData).forEach(([className, syllabus]) => {
      if (Array.isArray(syllabus)) {
        const row = classSyllabusToRow(className, syllabus, userId);
        // Always ensure id is set — use existing DB id or generate a new UUID
        row.id = existingMap[className] || (
          (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
        );
        rowsToUpsert.push(row);
      }
    });

    if (rowsToUpsert.length > 0) {
      const { error } = await db.from('myspace_class_units').upsert(rowsToUpsert, { onConflict: 'id' });
      if (error) console.error('[Sync] Upsert class syllabus error:', error);
    }

    // Optionally clean up duplicates or removed classes, but we'll leave them to prevent RLS delete issues
  }

  // Tasks & Categories
  async function cloudLoadTasks(userId) {
    const { data, error } = await db.from('myspace_tasks')
      .select('*').eq('user_id', userId);
    if (error) { console.error('[Sync] Load tasks error:', error); return null; }
    
    return (data || []).map(row => ({
      id: row.local_id, // Map back to local ID
      text: row.text,
      category: row.category,
      priority: row.priority,
      deadline: row.deadline,
      completed: row.completed,
      createdAt: row.created_at
    }));
  }

  async function cloudSaveTasks(userId, tasks) {
    const rows = tasks.map(t => ({
      user_id: userId,
      local_id: t.id,
      text: t.text,
      category: t.category,
      priority: t.priority,
      deadline: t.deadline,
      completed: !!t.completed,
      created_at: t.createdAt
    }));

    if (rows.length === 0) {
      // If we want to support clearing all tasks, we might need a delete call here
      // but for simple sync, we just return
      return;
    }

    const { error } = await db.from('myspace_tasks').upsert(rows, { onConflict: 'user_id,local_id' });
    if (error) console.error('[Sync] Save tasks error:', error);
  }

  async function cloudLoadTaskCategories(userId) {
    const { data, error } = await db.from('myspace_task_categories')
      .select('categories').eq('user_id', userId).maybeSingle();
    if (error) { console.error('[Sync] Load categories error:', error); return null; }
    return data?.categories || null;
  }

  async function cloudSaveTaskCategories(userId, categories) {
    const { error } = await db.from('myspace_task_categories')
      .upsert({ user_id: userId, categories: categories }, { onConflict: 'user_id' });
    if (error) console.error('[Sync] Save categories error:', error);
  }

  // My Class (Dedicated table: myspace_my_class)
  // Schema: id, user_id, class_name, attendance, skills, reflections, students, student_skills, updated_at
  async function cloudLoadMyClass(userId) {
    const { data, error } = await db.from('myspace_my_class')
      .select('class_name, attendance, skills, reflections, students, student_skills')
      .eq('user_id', userId);
    if (error) { console.error('[Sync] Load myspace_my_class error:', error); return null; }
    
    // Reconstruct the data object for the local application
    const result = { classes: {} };
    (data || []).forEach(row => {
      result.classes[row.class_name] = {
        students: row.students || [],
        attendance: row.attendance || {},
        skills: row.skills || [],
        studentSkills: row.student_skills || {},
        reflections: row.reflections || []
      };
    });
    return result;
  }

  async function cloudSaveMyClass(userId, fullData) {
    if (!fullData || !fullData.classes) return;

    // 1. Fetch existing rows to map Class Name -> DB ID
    const { data: existing, error: fetchErr } = await db.from('myspace_my_class')
      .select('id, class_name').eq('user_id', userId);
    
    if (fetchErr) {
      console.error('[Sync] Fetch existing my_class error:', fetchErr);
      return;
    }

    const existingMap = {};
    (existing || []).forEach(row => {
      if (row.class_name) existingMap[row.class_name] = row.id;
    });

    // 2. Prepare rows
    const rowsToUpsert = Object.entries(fullData.classes).map(([className, classData]) => {
      const existingId = existingMap[className];
      const finalId = existingId || (
        (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0')
      );

      return {
        id: finalId,
        user_id: userId,
        class_name: className,
        students: classData.students || [],
        attendance: classData.attendance || {},
        skills: classData.skills || [],
        student_skills: classData.studentSkills || {},
        reflections: classData.reflections || [],
        updated_at: new Date().toISOString()
      };
    }).filter(row => row.id && row.class_name);

    if (rowsToUpsert.length === 0) return;

    console.info(`[Sync] Upserting ${rowsToUpsert.length} classes to myspace_my_class...`);
    
    const { error } = await db.from('myspace_my_class')
      .upsert(rowsToUpsert, { onConflict: 'user_id,class_name' });
      
    if (error) {
      console.error('[Sync] Save myspace_my_class error:', error);
    } else {
      console.info('[Sync] myspace_my_class saved successfully.');
    }
  }

  // ── Core Read Logic ──────────────────────────────────────────────

  function getSessionForDate(className, targetDate, allEvents, redDays, syllabusMap, targetStartTime = null) {
    // 1. FETCH master row & 3. GENERATE valid dates
    // allEvents already contains all generated dates.
    // Filter to occurrences of the class, excluding red days.
    const instances = allEvents
      .filter(e => e.name === className && e.typeId === 'class')
      .filter(e => !(e.isRecurrence && redDays.includes(e.date)))
      // Ensure master events are included unless they have an explicit clone for the same date
      .filter(e => {
        if (!e.isRecurrence && e.recurrence && e.recurrence !== 'none') {
          const hasClone = allEvents.some(other => 
            other.isRecurrence && 
            (other.master_event_id === e.id || other.recurrence_id === e.id) && 
            other.date === e.date
          );
          return !hasClone;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    // 4. ASSIGN sequence index
    const sequenceIndex = instances.findIndex(e => 
      e.date === targetDate && (!targetStartTime || e.startTime === targetStartTime)
    );
    const targetInstance = instances[sequenceIndex];

    if (!targetInstance) {
      return { date: targetDate, sequenceIndex: -1, lesson: null, override_type: null };
    }

    // 5. CHECK for override
    const override_type = targetInstance.overrideType || null;
    let lesson = null;

    // 6. RESOLVE session content
    if (!override_type && sequenceIndex >= 0) {
      const syllabus = syllabusMap[className] || [];
      lesson = syllabus[sequenceIndex] || null;
    }

    // 7. RETURN
    return { date: targetDate, sequenceIndex, lesson, override_type };
  }

  function getAdminDataForClass(className, adminDataMap) {
    // 1. FETCH one row (from memory map)
    const tasks = adminDataMap[className];
    // 2. If row does not exist, return empty array
    if (!tasks || !Array.isArray(tasks)) {
      return [];
    }
    return tasks;
  }

  // ── Recurrence Logic ─────────────────────────────────────────────

  function getDayString(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function generateRecurrences(event, rangeStart, rangeEnd) {
    if (!event.recurrence || event.recurrence === 'none') return [];
    
    const occurrences = [];
    const originalDate = new Date(event.date);
    
    // Cap repetition at 6 months from the original date
    const maxEndDate = new Date(originalDate);
    maxEndDate.setMonth(maxEndDate.getMonth() + 6);
    
    // Also cap by graduation date if applicable
    const rangeEndFinal = (event.graduationClass && event.graduationDate) 
      ? new Date(Math.min(rangeEnd.getTime(), new Date(event.graduationDate + 'T23:59:59').getTime(), maxEndDate.getTime()))
      : new Date(Math.min(rangeEnd.getTime(), maxEndDate.getTime()));

    const maxIterations = 200; // safety limit
    
    // Custom Days recurrence
    if (event.recurrence === 'custom-days') {
      if (!event.recurrenceDays || event.recurrenceDays.length === 0) return [];
      
      let checkDate = new Date(originalDate);
      checkDate.setHours(0,0,0,0);
      let iterations = 0;
      
      while (iterations < maxIterations) {
        iterations++;
        checkDate.setDate(checkDate.getDate() + 1);
        if (checkDate > rangeEndFinal) break;
        
        const day = checkDate.getDay();
        const dayIndex = day === 0 ? 6 : day - 1; // Mon=0, Sun=6
        
        if (event.recurrenceDays.includes(dayIndex) && checkDate >= rangeStart) {
          const dateStr = getDayString(checkDate);
          occurrences.push({
            ...event,
            id: `${event.id}_recur_${dateStr}`,
            date: dateStr,
            isRecurrence: true,
            originalEventId: event.id,
            originalDate: dateStr,
            originalStartTime: event.startTime,
            originalEndTime: event.endTime,
            originalRoom: event.room || '',
            originalName: event.name,
            originalColor: event.color,
            _modified: false,
            checklist: (event.checklist || []).map(item => ({ ...item, done: false })),
            overrideType: ''
          });
        }
      }
    } else {
      // Standard recurrence types
      let currentDate = new Date(originalDate);
      const stepDays = {
        'daily': 1,
        'weekly': 7,
        'biweekly': 14,
        'monthly': 0
      };
      let iterations = 0;
      
      while (iterations < maxIterations) {
        iterations++;
        
        if (event.recurrence === 'monthly') {
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
          const days = stepDays[event.recurrence];
          if (!days) break;
          currentDate = new Date(currentDate.getTime() + days * 86400000);
        }
        
        if (currentDate > rangeEndFinal) break;
        
        if (currentDate >= rangeStart && currentDate.toDateString() !== originalDate.toDateString()) {
          const dateStr = getDayString(currentDate);
          occurrences.push({
            ...event,
            id: `${event.id}_recur_${dateStr}`,
            date: dateStr,
            isRecurrence: true,
            originalEventId: event.id,
            originalDate: dateStr,
            originalStartTime: event.startTime,
            originalEndTime: event.endTime,
            originalRoom: event.room || '',
            originalName: event.name,
            originalColor: event.color,
            _modified: false,
            checklist: (event.checklist || []).map(item => ({ ...item, done: false })),
            overrideType: ''
          });
        }
      }
    }
    
    // Merge in any promoted instances from localStorage (applies to ALL recurrence types)
    const promotedRaw = localStorage.getItem('schedule_promoted_instances');
    if (promotedRaw) {
      try {
        const promoted = JSON.parse(promotedRaw);
        occurrences.forEach((occ, idx) => {
          const match = promoted.find(p => p.id === occ.id);
          if (match) {
            occurrences[idx] = match;
          }
        });
      } catch (e) {
        console.error('[Recurrence] Failed to parse promoted instances:', e);
      }
    }

    return occurrences;
  }

  // ── Bulk sync helpers ────────────────────────────────────────────

  async function syncToCloud(userId) {
    console.log('[Sync] Syncing localStorage → Cloud for', userId);
    setSyncBadge('syncing');
    try {
      // Read from localStorage
      const eventsRaw = localStorage.getItem('schedule_events');
      const promotedRaw = localStorage.getItem('schedule_promoted_instances');
      const redDaysRaw = localStorage.getItem('schedule_red_days');
      const adminRaw = localStorage.getItem('schedule_class_admin');
      const unitsRaw = localStorage.getItem('schedule_class_units');

      const evts = eventsRaw ? JSON.parse(eventsRaw) : [];
      const prom = promotedRaw ? JSON.parse(promotedRaw) : [];
      const rds = redDaysRaw ? JSON.parse(redDaysRaw) : [];
      const adm = adminRaw ? JSON.parse(adminRaw) : {};
      const uns = unitsRaw ? JSON.parse(unitsRaw) : {};

      // Requirement: Split into two upserts
      const mastersRows = evts.filter(e => !e.isRecurrence).map(e => sanitiseForCloud(e, userId)).filter(r => r !== null);
      const promotedRows = prom.filter(e => e.isRecurrence && isPromoted(e))
        .map(e => sanitiseForCloud(e, userId))
        .filter(r => r !== null);

      // Settings aggregation
      const settings = {
        dates: rds,
        schedule: {
          weekDayCount: localStorage.getItem('schedule_week_day_count'),
          viewMode: localStorage.getItem('schedule_view_mode'),
          startHour: localStorage.getItem('schedule_start_hour'),
          endHour: localStorage.getItem('schedule_end_hour'),
          theme: localStorage.getItem('theme_schedule')
        },
        admin_tracker: {
          unitPlanningMode: localStorage.getItem('kk_unit_planning_mode') === 'true',
          theme: localStorage.getItem('theme_admin-tracker')
        },
        task: {
          currentTab: localStorage.getItem('tasks_current_tab'),
          timeFilter: localStorage.getItem('tasks_time_filter'),
          currentSort: localStorage.getItem('tasks_current_sort'),
          theme: localStorage.getItem('theme_tasks')
        },
        class: {
          lastSelected: localStorage.getItem('kk_myclass_last_selected'),
          theme: localStorage.getItem('theme_my-class')
        }
      };

      // Tasks
      const tasks = JSON.parse(localStorage.getItem('klasskit_tasks') || '[]');
      const cats = JSON.parse(localStorage.getItem('klasskit_categories') || '[]');
      
      // My Class Data
      const myClassData = JSON.parse(localStorage.getItem('prog_my-class') || '{"classes":{}}');

      await Promise.all([
        db.from('myspace_events').upsert(mastersRows, { onConflict: 'id' }),
        db.from('myspace_events').upsert(promotedRows, { onConflict: 'id' }),
        cloudSaveSettings(userId, settings),
        cloudSaveClassAdmin(userId, adm),
        cloudSaveClassUnits(userId, uns),
        cloudSaveTasks(userId, tasks),
        cloudSaveTaskCategories(userId, cats),
        cloudSaveMyClass(userId, myClassData)
      ]);

      setSyncBadge('synced');
      console.log('[Sync] Upload complete.');
    } catch (err) {
      console.error('[Sync] syncToCloud failed:', err);
      setSyncBadge('error');
    }
  }

  async function loadFromCloud(userId) {
    console.log('[Sync] Loading Cloud → localStorage for', userId);
    setSyncBadge('syncing');
    try {
      const [evts, settings, adm, uns, tasks, cats, myClass] = await Promise.all([
        cloudLoadScheduleEvents(userId),
        cloudLoadSettings(userId),
        cloudLoadClassAdmin(userId),
        cloudLoadClassUnits(userId),
        cloudLoadTasks(userId),
        cloudLoadTaskCategories(userId),
        cloudLoadMyClass(userId)
      ]);

      // Write to localStorage
      if (evts !== null) {
        localStorage.setItem('schedule_events', JSON.stringify(evts.masters));
        localStorage.setItem('schedule_promoted_instances', JSON.stringify(evts.promoted));
      }
      if (settings !== null) {
        localStorage.setItem('schedule_red_days', JSON.stringify(settings.dates || []));
        
        // Schedule settings
        const s = settings.schedule || {};
        if (s.weekDayCount) localStorage.setItem('schedule_week_day_count', s.weekDayCount);
        if (s.viewMode) localStorage.setItem('schedule_view_mode', s.viewMode);
        if (s.startHour) localStorage.setItem('schedule_start_hour', s.startHour);
        if (s.endHour) localStorage.setItem('schedule_end_hour', s.endHour);
        if (s.theme) localStorage.setItem('theme_schedule', s.theme);

        // Admin Tracker settings
        const a = settings.admin_tracker || {};
        if (a.unitPlanningMode !== undefined) localStorage.setItem('kk_unit_planning_mode', a.unitPlanningMode);
        if (a.theme) localStorage.setItem('theme_admin-tracker', a.theme);

        // Tasks settings
        const t = settings.task || {};
        if (t.currentTab) localStorage.setItem('tasks_current_tab', t.currentTab);
        if (t.timeFilter) localStorage.setItem('tasks_time_filter', t.timeFilter);
        if (t.currentSort) localStorage.setItem('tasks_current_sort', t.currentSort);
        if (t.theme) localStorage.setItem('theme_tasks', t.theme);

        // Class settings
        const c = settings.class || {};
        if (c.lastSelected) localStorage.setItem('kk_myclass_last_selected', c.lastSelected);
        if (c.theme) localStorage.setItem('theme_my-class', c.theme);
      }
      if (adm !== null) localStorage.setItem('schedule_class_admin', JSON.stringify(adm));
      if (uns !== null) localStorage.setItem('schedule_class_units', JSON.stringify(uns));
      if (tasks !== null) localStorage.setItem('klasskit_tasks', JSON.stringify(tasks));
      if (cats !== null) localStorage.setItem('klasskit_categories', JSON.stringify(cats));
      if (myClass !== null) localStorage.setItem('prog_my-class', JSON.stringify(myClass));

      setSyncBadge('synced');
      console.log('[Sync] Download complete. Triggering re-render…');

      // Trigger page-specific re-render
      if (typeof window._syncRerender === 'function') {
        window._syncRerender();
      }
    } catch (err) {
      console.error('[Sync] loadFromCloud failed:', err);
      setSyncBadge('error');
    }
  }

  // ── One-time migration on first cloud login ──────────────────────

  async function handleFirstCloudLogin(userId) {
    const migrationKey = 'kk_schedule_migrated_to_cloud';
    await loadFromCloud(userId);
    localStorage.setItem(migrationKey, 'true');
  }

  // ── Toast helper (works in both tools) ───────────────────────────

  // ── Global Toast Helper ──────────────────────────────────────────
  console.log('[Sync] Defining window.showToast');
  window.showToast = function (message, type = 'info') {
    console.log(`[Toast] Calling toast: "${message}" (${type})`);
    try {
      let container = document.getElementById('toastContainer');
      if (!container) {
        console.log('[Toast] Creating container');
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 items-center pointer-events-none';
        document.body.appendChild(container);
      }

      const types = {
        info: { icon: 'info', color: 'bg-blue text-white' },
        success: { icon: 'check-circle', color: 'bg-green text-white' },
        warning: { icon: 'alert-triangle', color: 'bg-orange text-white' },
        error: { icon: 'x-circle', color: 'bg-pink text-white' }
      };
      const config = types[type] || types.info;

      // Enhanced prominent styling for warnings/errors
      const isCritical = type === 'error' || type === 'warning';
      const shadowStyle = isCritical
        ? 'shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-dark'
        : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]';
      const sizeClasses = isCritical ? 'px-6 py-4 text-base scale-110' : 'px-4 py-3 text-sm';

      const toast = document.createElement('div');
      toast.className = `${sizeClasses} rounded-[var(--radius-2xl)] font-bold flex items-center gap-4 transform transition-all duration-500 translate-y-10 opacity-0 ${config.color} border-[3px] ${shadowStyle} pointer-events-auto cursor-pointer`;

      // If critical, we might want to put it in its own centered container or just make it fixed
      if (isCritical) {
        toast.style.position = 'fixed';
        toast.style.top = '50%';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%, -50%) scale(0.5)';
        toast.style.zIndex = '1000';
      }

      toast.innerHTML = `
        <i data-lucide="${config.icon}" class="${isCritical ? 'w-6 h-6' : 'w-5 h-5'}"></i>
        <div class="flex flex-col">
          <span>${message}</span>
          ${isCritical ? '<span class="text-[10px] opacity-70 uppercase tracking-widest mt-1">Click to dismiss</span>' : ''}
        </div>
      `;

      if (isCritical) {
        document.body.appendChild(toast);
        toast.onclick = () => { toast.remove(); };
      } else {
        container.appendChild(toast);
      }
      if (window.lucide) {
        lucide.createIcons({ root: toast });
      } else {
        console.warn('[Toast] Lucide not found, icons skipped');
      }

      setTimeout(() => {
        if (isCritical) {
          toast.style.transform = 'translate(-50%, -50%) scale(1)';
          toast.style.opacity = '1';
        } else {
          toast.classList.remove('translate-y-10', 'opacity-0');
          toast.classList.add('translate-y-0', 'opacity-100');
        }
      }, 10);

      const duration = isCritical ? 6000 : 4000;
      setTimeout(() => {
        if (toast.parentElement) {
          if (isCritical) {
            toast.style.transform = 'translate(-50%, -50%) scale(0.5)';
            toast.style.opacity = '0';
          } else {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-10', 'opacity-0');
          }
          setTimeout(() => toast.remove(), 500);
        }
      }, duration);
    } catch (err) {
      console.error('[Toast] Failed to show toast:', err);
      // Fallback to alert if it's a critical warning/error
      if (type === 'error' || type === 'warning') {
        alert(`${type.toUpperCase()}: ${message}`);
      }
    }
  };

  // ── Global Confirm Helper ──────────────────────────────────────────
  window.showConfirm = function (message) {
    return new Promise((resolve) => {
      const modalId = 'global-confirm-modal';
      let modal = document.getElementById(modalId);
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-dark/40 backdrop-blur-md"></div>
        <div class="relative bg-white dark:bg-slate-900 border-[3px] border-dark dark:border-slate-700 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-sm w-full animate-pop-in">
          <div class="mb-6">
            <div class="flex items-center gap-3 mb-2">
              <i data-lucide="check-circle" class="w-6 h-6 text-blue"></i>
              <h3 class="font-heading text-2xl font-bold text-dark dark:text-white uppercase tracking-tight">Confirm</h3>
            </div>
            <p class="font-body font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">${message}</p>
          </div>
          <div class="flex gap-3">
            <button id="confirm-cancel" class="btn-chunky flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600">Cancel</button>
            <button id="confirm-ok" class="btn-chunky flex-1 py-3 rounded-xl bg-blue text-white border-dark">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      if (window.lucide) lucide.createIcons({ root: modal });

      modal.querySelector('#confirm-ok').onclick = () => {
        modal.remove();
        resolve(true);
      };
      modal.querySelector('#confirm-cancel').onclick = () => {
        modal.remove();
        resolve(false);
      };
    });
  };

  // ── Global Prompt Helper ──────────────────────────────────────────
  window.showPrompt = function (message, defaultValue = '') {
    return new Promise((resolve) => {
      const modalId = 'global-prompt-modal';
      let modal = document.getElementById(modalId);
      if (modal) modal.remove();

      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-fade-in';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-dark/40 backdrop-blur-md"></div>
        <div class="relative bg-white dark:bg-slate-900 border-[3px] border-dark dark:border-slate-700 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 max-w-sm w-full animate-pop-in">
          <div class="mb-6">
            <div class="flex items-center gap-3 mb-2">
              <i data-lucide="help-circle" class="w-6 h-6 text-orange"></i>
              <h3 class="font-heading text-2xl font-bold text-dark dark:text-white uppercase tracking-tight">Input Needed</h3>
            </div>
            <p class="font-body font-semibold text-slate-600 dark:text-slate-400 mb-4">${message}</p>
            <input type="text" id="prompt-input" value="${defaultValue}" class="w-full px-4 py-3 rounded-xl border-[3px] border-dark dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-dark dark:text-white font-bold focus:outline-none focus:border-blue transition-colors" autofocus>
          </div>
          <div class="flex gap-3">
            <button id="prompt-cancel" class="btn-chunky flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600">Cancel</button>
            <button id="prompt-ok" class="btn-chunky flex-1 py-3 rounded-xl bg-blue text-white border-dark">Done</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      if (window.lucide) lucide.createIcons({ root: modal });

      const input = modal.querySelector('#prompt-input');
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      input.onkeydown = (e) => {
        if (e.key === 'Enter') modal.querySelector('#prompt-ok').click();
        if (e.key === 'Escape') modal.querySelector('#prompt-cancel').click();
      };

      modal.querySelector('#prompt-ok').onclick = () => {
        const val = input.value;
        modal.remove();
        resolve(val);
      };
      modal.querySelector('#prompt-cancel').onclick = () => {
        modal.remove();
        resolve(null);
      };
    });
  };


  function showSyncToast(message) {
    window.showToast(message, 'success');
  }

  // ── Non-blocking fire-and-forget upsert wrapper ──────────────────

  let _cachedUserId = null;

  async function getCachedUserId() {
    if (_cachedUserId) return _cachedUserId;
    const user = await getUser();
    if (user && !user.is_sandbox) _cachedUserId = user.id;
    return _cachedUserId;
  }

  let _saveQueue = Promise.resolve();

  // Fire a cloud write without blocking UI. Sets badge to syncing/synced.
  function fireCloudSave(saveFn) {
    if (!isCloudMode()) return;
    getCachedUserId().then(userId => {
      if (!userId) return;
      setSyncBadge('syncing');

      _saveQueue = _saveQueue
        .then(() => saveFn(userId))
        .then(() => setSyncBadge('synced'))
        .catch(err => {
          console.error('[Sync] Background save failed:', err);
          setSyncBadge('error');
        });
    });
  }

  // ── Promoted instance upsert (fire-and-forget) ──────────────────

  function syncPromotedInstance(evt) {
    if (!isCloudMode()) return;
    if (!evt.isRecurrence) return;

    const promoted = isPromoted(evt);

    getCachedUserId().then(userId => {
      if (!userId) return;

      if (promoted) {
        const row = sanitiseForCloud(evt, userId);
        if (!row) return;

        db.from('myspace_events')
          .upsert(row, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) {
              console.error('[Sync] Promoted upsert failed:', error);
            } else {
              console.log('[Sync] Promoted instance saved:', evt.id);
            }
          })
          .catch(err => console.error('[Sync] Promoted upsert exception:', err));
      } else {
        // DELETE if NO LONGER promoted (Demotion)
        db.from('myspace_events')
          .delete()
          .eq('user_id', userId)
          .eq('id', evt.id)
          .then(({ error }) => {
            if (!error) {
              console.log('[Sync] Instance demoted (removed from cloud):', evt.id);
            }
          })
          .catch(err => console.error('[Sync] Demotion failed:', err));
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────────

  window.Sync = {
    isCloudMode,
    syncToCloud,
    loadFromCloud,
    handleFirstCloudLogin,
    setSyncBadge,

    cloudLoadScheduleEvents,
    cloudSaveScheduleEvents,
    cloudReplaceAllScheduleEvents,
    cloudDeleteScheduleEvent,
    cloudLoadSettings,
    cloudSaveSettings,
    cloudLoadClassAdmin,
    cloudSaveClassAdmin,
    cloudLoadClassUnits,
    cloudSaveClassUnits,

    cloudLoadTasks,
    cloudSaveTasks,
    cloudLoadTaskCategories,
    cloudSaveTaskCategories,
    cloudLoadMyClass,
    cloudSaveMyClass,

    fireCloudSave,
    getCachedUserId,
    isPromoted,
    syncPromotedInstance,

    getSessionForDate,
    getAdminDataForClass,

    // Helpers
    getDayString,
    generateRecurrences
  };

  // Legacy globals for backward compatibility
  window.getDayString = getDayString;
  window.generateRecurrences = generateRecurrences;

})();