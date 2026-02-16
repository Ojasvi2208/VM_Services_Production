package com.vmfinancial.shared

interface Platform {
    val name: String
}

expect fun getPlatform(): Platform
