{{- define "mathboard.labels" -}}
app.kubernetes.io/name: mathboard
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end }}

{{- define "mathboard.selector" -}}
app.kubernetes.io/name: mathboard
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end }}

{{- define "mathboard.appSecretName" -}}
{{ .Release.Name }}-app
{{- end }}
