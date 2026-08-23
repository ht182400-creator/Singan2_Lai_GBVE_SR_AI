import React from 'react';

/**
 * List 视图：每行一条结果。
 */
export default function ListResultsView({ results }) {
  if (!results || results.length === 0) {
    return <div className="list-empty">No results.</div>;
  }
  return (
    <table className="list-results">
      <thead>
        <tr>
          <th>#</th><th>Name</th><th>Ver</th><th>LE</th><th>SE</th>
          <th>IR Add</th><th>G Add</th><th>Binary Add</th><th>Speed</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{r.name}</td>
            <td className={r.ver === 'NG' ? 'ng' : 'ok'}>{r.ver}</td>
            <td>{r.le?.toFixed?.(2) ?? r.le}</td>
            <td>{r.se?.toFixed?.(2) ?? r.se}</td>
            <td>{r.irAdd}</td>
            <td>{r.gAdd}</td>
            <td>{r.binaryAdd}</td>
            <td>{r.speed?.toFixed?.(2) ?? r.speed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
