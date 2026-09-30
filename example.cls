Class ObjectScript.Examples {
  /// demo of public and private methods, along with a public variable
  ClassMethod PrivatePublic() {
    Do ..Private() // call a private method
    Do ..Public(9) // call a public method
  }
}
