(function () {
  function trimDecimal(value) {
    return value.replace(/\.0+$|(?<=\.[0-9])0+$/, '').replace(/\.$/, '');
  }

  function compactToken(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    const absolute = Math.abs(number);
    if (absolute >= 1000000) return `${trimDecimal((number / 1000000).toFixed(2))}M`;
    if (absolute >= 1000) return `${trimDecimal((number / 1000).toFixed(2))}K`;
    return String(Math.round(number));
  }

  function formatUsd(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '';
    return `$${trimDecimal(number.toFixed(2))} USD`;
  }

  function tokenSummary(job) {
    const total = Number(job.total_tokens);
    if (!Number.isFinite(total)) return '';
    const input = Number(job.input_tokens) || 0;
    const cached = Number(job.cached_input_tokens) || 0;
    const output = Number(job.output_tokens) || 0;
    const reasoning = Number(job.reasoning_output_tokens) || 0;
    const uncached = Math.max(0, input - cached);
    const cost = formatUsd(job.cost_usd);
    const model = job.pricing_model ? `（${job.pricing_model} Standard）` : '';
    const costText = cost ? `，估算成本 ${cost}${model}` : '';
    return `累计 ${compactToken(total)} tokens（输入 ${compactToken(input)}，缓存输入 ${compactToken(cached)}，未缓存输入 ${compactToken(uncached)}，输出 ${compactToken(output)}，其中推理 ${compactToken(reasoning)}${costText}）`;
  }

  // Structured figures for the status cards: [{label, value, detail}].
  function tokenStats(job) {
    const total = Number(job.total_tokens);
    if (!Number.isFinite(total) || total <= 0) return [];
    const input = Number(job.input_tokens) || 0;
    const cached = Number(job.cached_input_tokens) || 0;
    const output = Number(job.output_tokens) || 0;
    const reasoning = Number(job.reasoning_output_tokens) || 0;
    const stats = [
      { label: '总 tokens', value: compactToken(total), detail: '' },
      { label: '输入', value: compactToken(input), detail: `未缓存 ${compactToken(Math.max(0, input - cached))}` },
      { label: '缓存命中', value: compactToken(cached), detail: input ? `${Math.round((cached / input) * 100)}%` : '' },
      { label: '输出', value: compactToken(output), detail: `推理 ${compactToken(reasoning)}` },
    ];
    const cost = Number(job.cost_usd);
    if (Number.isFinite(cost)) {
      stats.push({ label: '估算成本', value: `$${trimDecimal(cost.toFixed(2))}`, detail: job.pricing_model || '' });
    }
    return stats;
  }

  function tokenBrief(job) {
    const total = Number(job.total_tokens);
    if (!Number.isFinite(total) || total <= 0) return '';
    const cost = Number(job.cost_usd);
    return `${compactToken(total)} tokens${Number.isFinite(cost) ? ` · $${trimDecimal(cost.toFixed(2))}` : ''}`;
  }

  function formatDuration(seconds) {
    const total = Math.round(Number(seconds) || 0);
    if (total <= 0) return '';
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const rest = total % 60;
    if (hours) return `${hours}小时${String(minutes).padStart(2, '0')}分`;
    if (minutes) return `${minutes}分${String(rest).padStart(2, '0')}秒`;
    return `${rest}秒`;
  }

  window.arxivDuration = job => formatDuration(job && job.elapsed_seconds);
  window.arxivTokenStats = tokenStats;
  window.arxivTokenBrief = tokenBrief;
  window.arxivCompactToken = compactToken;
  window.arxivTokenSummary = tokenSummary;
}
());

// Start the Appendix translation for a completed job and wait until it finishes.
// onProgress receives each intermediate job state; the resolved value is the final job.
window.arxivTranslateAppendix = async function arxivTranslateAppendix(apiUrl, jobId, onProgress) {
  const jobUrl = apiUrl(`/api/jobs/${encodeURIComponent(jobId)}`);
  const started = await fetch(`${jobUrl}/appendix`, { method: 'POST' });
  let job = await started.json().catch(() => ({}));
  if (!started.ok) throw new Error(job.error || `HTTP ${started.status}`);
  while (job.status === 'queued' || job.status === 'running') {
    if (onProgress) onProgress(job);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const response = await fetch(jobUrl);
    job = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(job.error || `HTTP ${response.status}`);
  }
  if (job.status !== 'completed') throw new Error(job.error || '翻译 Appendix 失败');
  return job;
};

window.arxivPendingAppendixCount = function arxivPendingAppendixCount(job) {
  return job && job.status === 'completed' && Array.isArray(job.appendix_files) ? job.appendix_files.length : 0;
};
