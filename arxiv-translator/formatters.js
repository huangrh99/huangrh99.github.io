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

  window.arxivCompactToken = compactToken;
  window.arxivTokenSummary = tokenSummary;
}
());
