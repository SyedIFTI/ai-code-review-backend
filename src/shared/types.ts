export type ApiResponse<T>={
    success:boolean,
    error:Record<string,string>|null,
    data :T|null,
    message:string
}
export type AISeverity = 'bug' | 'security' | 'performance' | 'style'
export type DBSeverity = 'critical' | 'warning' | 'info'
export type DBCategory = 'bug' | 'security' | 'performance' | 'style' | 'suggestion'