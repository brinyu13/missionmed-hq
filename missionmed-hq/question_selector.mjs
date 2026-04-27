function normalizeCategory(value = '') {
  return String(value || '').trim();
}

function buildInFilter(values = []) {
  const safeValues = values
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .map((value) => value.replace(/[^a-zA-Z0-9_-]/gu, ''));
  return safeValues.length ? `in.(${safeValues.join(',')})` : '';
}

function weightedPick(items = []) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return null;
  }

  const total = safeItems.reduce((sum, item) => sum + Math.max(0.0001, Number(item.weight || 1)), 0);
  let threshold = Math.random() * total;

  for (const item of safeItems) {
    threshold -= Math.max(0.0001, Number(item.weight || 1));
    if (threshold <= 0) {
      return item;
    }
  }

  return safeItems[safeItems.length - 1] || null;
}

function toTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortLeastRecentlyUsed(questions = []) {
  return [...questions].sort((left, right) => {
    const leftStamp = toTimestamp(left?.last_used || left?.updated_at || 0);
    const rightStamp = toTimestamp(right?.last_used || right?.updated_at || 0);
    if (leftStamp !== rightStamp) {
      return leftStamp - rightStamp;
    }
    return Number(left?.use_count || 0) - Number(right?.use_count || 0);
  });
}

function deriveWeakSkills(rows = []) {
  if (!rows.length) {
    return {
      weak_opening: false,
      weak_reasons: false,
      weak_closing: false,
      averages: {
        s_score: 10,
        a_reasons: 10,
        e_closing: 10,
      },
    };
  }

  const totals = rows.reduce((acc, row) => {
    acc.s_score += Number(row?.s_score || 0);
    acc.a_reasons += Number(row?.a_reasons || 0);
    acc.e_closing += Number(row?.e_closing || 0);
    return acc;
  }, { s_score: 0, a_reasons: 0, e_closing: 0 });

  const count = rows.length;
  const averages = {
    s_score: totals.s_score / count,
    a_reasons: totals.a_reasons / count,
    e_closing: totals.e_closing / count,
  };

  return {
    weak_opening: averages.s_score < 5,
    weak_reasons: averages.a_reasons < 5,
    weak_closing: averages.e_closing < 5,
    averages,
  };
}

function categoryMatchesAny(category = '', needles = []) {
  const haystack = String(category || '').toLowerCase();
  if (!haystack) {
    return false;
  }
  return needles.some((needle) => haystack.includes(String(needle || '').toLowerCase()));
}

function deriveCategoryWeights(mode = '', candidates = [], recentCategoryRows = [], weakSkills = {}) {
  const recentCounts = new Map();
  for (const row of recentCategoryRows) {
    const category = normalizeCategory(row?.category).toLowerCase();
    if (!category) {
      continue;
    }
    recentCounts.set(category, (recentCounts.get(category) || 0) + 1);
  }

  const knownCategories = [...new Set(candidates.map((row) => normalizeCategory(row?.category).toLowerCase()).filter(Boolean))];
  const minCount = knownCategories.length
    ? Math.min(...knownCategories.map((category) => recentCounts.get(category) || 0))
    : 0;
  const underrepresented = new Set(knownCategories.filter((category) => (recentCounts.get(category) || 0) === minCount));

  return candidates.map((row) => {
    const category = normalizeCategory(row?.category).toLowerCase();
    let weight = 1;

    if (underrepresented.has(category)) {
      weight *= 3;
    }

    if (weakSkills.weak_opening && categoryMatchesAny(category, ['opening', 'intro', 'tell me'])) {
      weight *= 2;
    }
    if (weakSkills.weak_reasons && categoryMatchesAny(category, ['why', 'challenge', 'fit', 'career', 'reason'])) {
      weight *= 2;
    }
    if (weakSkills.weak_closing && categoryMatchesAny(category, ['closing', 'summary', 'final', 'conclusion'])) {
      weight *= 2;
    }

    if (String(mode || '').toLowerCase() === 'simulation') {
      weight *= 1.1;
    }

    return {
      ...row,
      weight,
    };
  });
}

export async function selectDbocQuestion({
  mode = '',
  category = '',
  userId = '',
  fetchSupabaseTable,
  headers = {},
}) {
  const normalizedMode = String(mode || '').trim().toLowerCase();
  const normalizedCategory = normalizeCategory(category);
  const safeUserId = String(userId || '').trim();

  if (!safeUserId) {
    throw new Error('question_select_user_required');
  }

  let poolPath = 'dboc_iv_questions?select=id,text,category,use_count,last_used,created_at&order=use_count.asc,last_used.asc.nullslast,created_at.asc&limit=500';
  if (normalizedMode === 'guided_practice' && normalizedCategory) {
    poolPath += `&category=eq.${encodeURIComponent(normalizedCategory)}`;
  }

  const poolResult = await fetchSupabaseTable(poolPath, { headers });
  if (!poolResult.ok) {
    throw new Error(poolResult.error || 'question_pool_failed');
  }

  let allQuestions = Array.isArray(poolResult.data) ? poolResult.data : [];
  if (!allQuestions.length) {
    const fallbackInsert = await fetchSupabaseTable(
      'dboc_iv_questions?select=id,text,category,use_count,last_used,created_at',
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'general',
          text: 'Tell me about yourself and why you are a strong fit for this residency program.',
          difficulty: 'core',
        }),
      },
    );

    if (fallbackInsert.ok && Array.isArray(fallbackInsert.data) && fallbackInsert.data[0]) {
      allQuestions = [fallbackInsert.data[0]];
    }
  }

  if (!allQuestions.length) {
    return {
      question: null,
      debug: {
        reason: 'empty_pool',
      },
    };
  }

  const recentSessionsResult = await fetchSupabaseTable(
    `dboc_iv_sessions?user_id=eq.${encodeURIComponent(safeUserId)}&select=question_id,created_at&order=created_at.desc&limit=200`,
    { headers },
  );
  if (!recentSessionsResult.ok) {
    throw new Error(recentSessionsResult.error || 'question_recent_sessions_failed');
  }

  const recentSessions = Array.isArray(recentSessionsResult.data) ? recentSessionsResult.data : [];
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentQuestionIds = new Set(
    recentSessions
      .filter((row) => toTimestamp(row?.created_at) >= sevenDaysAgo)
      .map((row) => String(row?.question_id || '').trim())
      .filter(Boolean),
  );

  const lastQuestionId = String(recentSessions[0]?.question_id || '').trim();

  let filtered = allQuestions.filter((row) => !recentQuestionIds.has(String(row?.id || '').trim()));
  if (filtered.length > 1 && lastQuestionId) {
    filtered = filtered.filter((row) => String(row?.id || '').trim() !== lastQuestionId);
  }

  if (!filtered.length) {
    filtered = sortLeastRecentlyUsed(allQuestions);
  }

  const recentCategorySessions = recentSessions.slice(0, 5);
  const categoryQuestionIds = recentCategorySessions
    .map((row) => String(row?.question_id || '').trim())
    .filter(Boolean);
  let recentCategoryRows = [];
  if (categoryQuestionIds.length) {
    const categoryFilter = buildInFilter(categoryQuestionIds);
    if (categoryFilter) {
      const categoryLookup = await fetchSupabaseTable(
        `dboc_iv_questions?id=${categoryFilter}&select=id,category`,
        { headers },
      );
      if (categoryLookup.ok && Array.isArray(categoryLookup.data)) {
        recentCategoryRows = categoryLookup.data;
      }
    }
  }

  const recentResponsesResult = await fetchSupabaseTable(
    `dboc_iv_responses?user_id=eq.${encodeURIComponent(safeUserId)}&select=id&order=created_at.desc&limit=10`,
    { headers },
  );

  const responseIds = recentResponsesResult.ok && Array.isArray(recentResponsesResult.data)
    ? recentResponsesResult.data.map((row) => String(row?.id || '').trim()).filter(Boolean)
    : [];
  let safRows = [];
  if (responseIds.length) {
    const responseFilter = buildInFilter(responseIds);
    if (responseFilter) {
      const safResult = await fetchSupabaseTable(
        `dboc_iv_saf_analysis?response_id=${responseFilter}&select=response_id,s_score,a_reasons,e_closing&order=created_at.desc&limit=10`,
        { headers },
      );
      if (safResult.ok && Array.isArray(safResult.data)) {
        safRows = safResult.data;
      }
    }
  }

  const weakSkills = deriveWeakSkills(safRows);
  const weightedPool = deriveCategoryWeights(normalizedMode, filtered, recentCategoryRows, weakSkills);
  const picked = weightedPick(weightedPool) || weightedPool[0] || null;

  if (!picked) {
    return {
      question: null,
      debug: {
        reason: 'pick_failed',
      },
    };
  }

  const currentUseCount = Number(picked.use_count || 0);
  const touchResult = await fetchSupabaseTable(
    `dboc_iv_questions?id=eq.${encodeURIComponent(String(picked.id || '').trim())}&select=id`,
    {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        last_used: new Date().toISOString(),
        use_count: currentUseCount + 1,
      }),
      timeoutMs: 15000,
    },
  );

  if (!touchResult.ok) {
    throw new Error(touchResult.error || 'question_touch_failed');
  }

  const teachingResult = await fetchSupabaseTable(
    `dboc_iv_teaching_videos?question_id=eq.${encodeURIComponent(String(picked.id || '').trim())}&select=video_url&order=created_at.desc&limit=1`,
    { headers },
  );
  const teachingVideo = teachingResult.ok && Array.isArray(teachingResult.data)
    ? teachingResult.data[0] || null
    : null;

  return {
    question: {
      id: picked.id,
      text: String(picked.text || ''),
      category: normalizeCategory(picked.category) || null,
      teaching_video_url: String(teachingVideo?.video_url || '').trim() || null,
    },
    debug: {
      pool_size: allQuestions.length,
      filtered_size: filtered.length,
      weak_skills: {
        opening: weakSkills.weak_opening,
        reasons: weakSkills.weak_reasons,
        closing: weakSkills.weak_closing,
      },
      averages: weakSkills.averages,
    },
  };
}
