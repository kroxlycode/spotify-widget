!include "FileFunc.nsh"

; Keep installs in a dedicated app folder even when user picks a parent path.
Function .onVerifyInstDir
  ${GetFileName} "$INSTDIR" $0
  StrCmp $0 "Spotify Widget" done
  StrCpy $INSTDIR "$INSTDIR\Spotify Widget"
done:
FunctionEnd
