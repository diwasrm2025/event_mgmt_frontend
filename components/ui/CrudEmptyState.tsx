export function CrudEmptyState({ name }: { name: string }) {
 return <div className="crud-empty-state" role="status"><div className="crud-empty-title">{name}</div><p>No data found for {name}.</p></div>;
}
export function CrudEmptyRow({ name, columns }: { name: string; columns: number }) {
 return <tr><td colSpan={columns}><CrudEmptyState name={name} /></td></tr>;
}
