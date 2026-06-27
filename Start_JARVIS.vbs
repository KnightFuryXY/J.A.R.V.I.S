Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Get the directory where this VBScript is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
mainScript = scriptDir & "\main.py"
pythonwPath = "C:\Users\Knigh\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"

' Check if main.py exists
If Not fso.FileExists(mainScript) Then
    MsgBox "Error: main.py not found in " & scriptDir, 16, "JARVIS Launcher"
    WScript.Quit
End If

' Launch JARVIS silently (0 = hide window)
WshShell.Run Chr(34) & pythonwPath & Chr(34) & " " & Chr(34) & mainScript & Chr(34), 0

Set WshShell = Nothing
Set fso = Nothing
