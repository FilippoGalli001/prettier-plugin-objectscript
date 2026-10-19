Class Demo.Orders.SignedMessage
{
  /// Name of the SSL configuration that holds the CA certificate.
  /// Only used to resolve the full path of the CA file.
  Parameter SSLConfig = "demo-orders-ca";

  /// Validates a message in the "Signed header.payload.signature" format.
  /// When no message is passed, it is read from the HTTP header of the current request.
  /// Returns "" when the message is valid, otherwise the error message.
  /// w ##class(Demo.Orders.SignedMessage).Validate("Signed eyJ0eXAiOiJNU0cifQ.e30.c2ln")
  ClassMethod Validate(
    rawHeader As %String = {%request.GetCgiEnv("HTTP_X_SIGNED_MESSAGE", "")}
  ) As %String
  {
    Set sc = $$$OK
    Try {
      If rawHeader '[ "Signed" {
        Set Validation = "Signed message header not found"
        Quit
      }
      ; *** split the message into its three parts: header, payload and signature
      Set rawHeader = $ZSTRIP($PIECE(rawHeader, "Signed", 2), "<>W")
      If (rawHeader = "") || ($l(rawHeader, ".") '= 3) {
        Set Validation = "Malformed message"
        Quit
      }
      Set $LISTBUILD(headerB64,
          payloadB64,
          signatureB64) = $LISTFROMSTRING(rawHeader, ".")

      Set header = ##class(%OAuth2.Utils).Base64UrlDecode(headerB64)
      Set header = {}.%FromJSON(header)

      Set payload = ##class(%OAuth2.Utils).Base64UrlDecode(payloadB64)
      Set payload = {}.%FromJSON(payload)

      Set signature = ##class(%OAuth2.Utils).Base64UrlDecode(signatureB64)

      ; extract the sender certificate from the header
      ; and read the Common Name from its Subject
      Set senderCert = $system.Encryption.Base64Decode(header.certs.%Get(0))
      Set senderCertSubject = $system.Encryption.X509GetField(
          senderCert,
          "Subject"
        )
      Set senderCertSubjectCN = $p($p(senderCertSubject, "CN=", 2), ",", 1)

      ; *** header checks

      ; allowed signature algorithms: RS256, RS384, RS512
      If '$lf($lb("RS256","RS384","RS512"),header.alg) {
        Set Validation = "Signature algorithm not allowed: "_header.alg
        Quit
      }
      Set Bitlength = $e(header.alg, 3, 5)

      ; the message type must be MSG
      If header.typ '= "MSG" {
        Set Validation = "Invalid message type: "_header.typ
        Quit
      }

      ; *** payload checks

      ; the certificate CN must match the sender declared in the payload
      Set senderCN = $zstrip($p(payload.sender, "orders:", 2), "<>W")
      If senderCertSubjectCN '= senderCN {
        Set Validation = "Sender does not match the certificate"
        Quit
      }
      If payload.orderId = "" {
        Set Validation = "Missing order identifier"
        Quit
      }
      ; the recipient must be the orders service
      If (payload.target '[ "/api/orders/v1") {
        Set Validation = "Invalid message recipient"
        Quit
      }
      ; the issue date cannot be in the future
      If (payload.issuedAt > $ZDATETIME($h, -2)) {
        Set Validation = "Invalid issue date: "_payload.issuedAt_" - "_$ZDATETIME($h,
            -2)
        Quit
      }
      ; the message must not be expired
      If (payload.expiresAt < $ZDATETIME($h, -2)) {
        Set Validation = "Message expired"
        Quit
      }

      ; *** signature verification

      Set FileCA = ..GetFileCA(.sc)
      If $$$ISERR(sc) Quit

      ; the sender certificate must be issued by the configured CA
      Set Result = $SYSTEM.Encryption.X509VerifyCertChain(senderCert, FileCA)
      If Result '= "OK" {
        Set Validation = "Untrusted sender certificate: "_Result
        Quit
      }
      ; verify the signature of header and payload
      Set SignIsValid = $system.Encryption.RSASHAVerify(
          Bitlength,
          headerB64_"."_payloadB64,
          signature,
          senderCert
        )
      If 'SignIsValid {
        Set Validation = "Invalid message signature"
        Quit
      }
      ; valid message
      Set Validation = ""
    } Catch CatchError {
      #dim CatchError as %Exception.SystemException
      Set sc = CatchError.AsStatus()
    }
    If $$$ISERR(sc) {
      Set Validation = $system.Status.GetErrorText(sc)
    }
    Quit Validation
  }

  /// Returns the full path of the CA file
  /// referenced by the SSL configuration of this class.
  ClassMethod GetFileCA(Output sc As %Status)
  {
    New $namespace
    ZNspace "%SYS"
    Set sc = $$$OK
    Try {
      Set sslConfig = ##class(Security.SSLConfigs).%OpenId(..#SSLConfig, , .sc)
      If $$$ISERR(sc) Quit
      Set FileCA = sslConfig.CAFile
    } Catch CatchError {
      #dim CatchError as %Exception.SystemException
      Set sc = CatchError.AsStatus()
    }
    Quit FileCA
  }
}
