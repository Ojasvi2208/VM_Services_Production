package com.vmfinancial.android.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PieChart
import androidx.compose.material.icons.automirrored.outlined.ShowChart
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.vmfinancial.android.ui.components.SideDrawerContent
import com.vmfinancial.android.ui.screens.home.HomeScreen
import com.vmfinancial.android.ui.screens.funds.FundsScreen
import com.vmfinancial.android.ui.screens.funds.FundDetailScreen
import com.vmfinancial.android.ui.screens.portfolio.PortfolioScreen
import com.vmfinancial.android.ui.screens.portfolio.CASImportScreen
import com.vmfinancial.android.ui.screens.portfolio.AnalyticsScreen
import com.vmfinancial.android.ui.screens.markets.MarketsScreen
import com.vmfinancial.android.ui.screens.markets.IndexDetailScreen
import com.vmfinancial.android.ui.screens.profile.ProfileScreen
import com.vmfinancial.android.ui.screens.fuel.FuelPriceScreen
import com.vmfinancial.android.ui.screens.premium.PremiumScreen
import com.vmfinancial.android.ui.screens.calculators.CalculatorsScreen
import com.vmfinancial.android.ui.screens.calculators.SIPCalculatorScreen
import com.vmfinancial.android.ui.screens.calculators.LumpsumCalculatorScreen
import com.vmfinancial.android.ui.screens.calculators.GoalPlannerScreen
import com.vmfinancial.android.ui.screens.calculators.SWPCalculatorScreen
import com.vmfinancial.android.ui.screens.calculators.StepUpSIPCalculatorScreen
import com.vmfinancial.android.ui.screens.learn.LearnScreen
import com.vmfinancial.android.ui.screens.learn.LearnArticleScreen
import com.vmfinancial.android.ui.screens.auth.AuthScreen
import com.vmfinancial.android.services.AuthService
import com.vmfinancial.android.ui.screens.expenses.ExpensesScreen
import com.vmfinancial.android.ui.screens.goals.GoalsScreen
import com.vmfinancial.android.ui.screens.goals.CreateGoalScreen
import com.vmfinancial.android.ui.screens.goals.GoalDetailScreen
import com.vmfinancial.android.ui.screens.home.ArticleViewerScreen
import com.vmfinancial.android.ui.screens.home.AllMarketsScreen
import com.vmfinancial.android.ui.screens.home.AllHeadlinesScreen
import com.vmfinancial.android.ui.screens.home.AllEventsScreen
import com.vmfinancial.android.ui.screens.home.AllCurrenciesScreen
import com.vmfinancial.android.ui.screens.home.AllCommoditiesScreen
import com.vmfinancial.android.ui.screens.home.AllNFOsScreen
import kotlinx.coroutines.launch

// Matches iOS: Home, Funds, Portfolio, Markets, Profile
sealed class Screen(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    object Home : Screen("home", "Home", Icons.Filled.Home, Icons.Outlined.Home)
    object Funds : Screen("funds", "Funds", Icons.Filled.AccountBalance, Icons.Outlined.AccountBalance)
    object Portfolio : Screen("portfolio", "Portfolio", Icons.Filled.PieChart, Icons.Outlined.PieChart)
    object Markets : Screen("markets", "Markets", Icons.AutoMirrored.Filled.ShowChart, Icons.AutoMirrored.Outlined.ShowChart)
    object Profile : Screen("profile", "Profile", Icons.Filled.Person, Icons.Outlined.Person)
    object FuelPrices : Screen("fuel_prices", "Fuel Prices", Icons.Filled.Home, Icons.Outlined.Home)
    object AllMarkets : Screen("see_all/markets", "Markets Today", Icons.Filled.Home, Icons.Outlined.Home)
    object AllHeadlines : Screen("see_all/headlines", "Headlines", Icons.Filled.Home, Icons.Outlined.Home)
    object AllEvents : Screen("see_all/events", "Upcoming Events", Icons.Filled.Home, Icons.Outlined.Home)
    object AllCurrencies : Screen("see_all/currencies", "Currency Rates", Icons.Filled.Home, Icons.Outlined.Home)
    object AllCommodities : Screen("see_all/commodities", "Commodities", Icons.Filled.Home, Icons.Outlined.Home)
    object AllNFOs : Screen("see_all/nfos", "Recently Launched Funds", Icons.Filled.Home, Icons.Outlined.Home)
    object Premium : Screen("premium", "Premium", Icons.Filled.Home, Icons.Outlined.Home)
    object Calculators : Screen("calculators", "Calculators", Icons.Filled.Home, Icons.Outlined.Home)
    object Learn : Screen("learn", "Learn", Icons.Filled.Home, Icons.Outlined.Home)
    object Auth : Screen("auth?mode={mode}", "Sign In", Icons.Filled.Home, Icons.Outlined.Home)
    object CASImport : Screen("cas_import", "Import CAS", Icons.Filled.Home, Icons.Outlined.Home)
    object Analytics : Screen("analytics", "Analytics", Icons.Filled.Home, Icons.Outlined.Home)
    object ArticleViewer : Screen("article_viewer", "Article", Icons.Filled.Home, Icons.Outlined.Home)
    object Expenses : Screen("expenses", "Expenses", Icons.Filled.Home, Icons.Outlined.Home)
    object Goals : Screen("goals", "Goals", Icons.Filled.Home, Icons.Outlined.Home)
    object CreateGoal : Screen("create_goal", "Create Goal", Icons.Filled.Home, Icons.Outlined.Home)
}

val bottomNavItems = listOf(
    Screen.Home,
    Screen.Funds,
    Screen.Portfolio,
    Screen.Markets,
    Screen.Profile
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VMNavigation(authService: AuthService? = null) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val currentUser by authService?.currentUser?.collectAsState()
        ?: remember { mutableStateOf<com.vmfinancial.android.services.AuthUser?>(null) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = currentDestination?.route in bottomNavItems.map { it.route },
        drawerContent = {
            ModalDrawerSheet {
                SideDrawerContent(
                    selectedTab = bottomNavItems.indexOfFirst { currentDestination?.route == it.route }.coerceAtLeast(0),
                    onTabSelect = { index ->
                        val route = bottomNavItems.getOrNull(index)?.route ?: return@SideDrawerContent
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onClose = { scope.launch { drawerState.close() } },
                    onNavigate = { route ->
                        scope.launch { drawerState.close() }
                        navController.navigate(route) { launchSingleTop = true }
                    },
                    currentUser = currentUser,
                    onSignIn = {
                        scope.launch { drawerState.close() }
                        navController.navigate("auth?mode=signin") { launchSingleTop = true }
                    },
                    onSignOut = { authService?.signOut() }
                )
            }
        }
    ) {
    Scaffold(
        bottomBar = {
            // Only show bottom bar for main tabs
            val currentRoute = currentDestination?.route
            if (currentRoute in bottomNavItems.map { it.route }) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurface
                ) {
                    bottomNavItems.forEach { screen ->
                        val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true

                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (selected) screen.selectedIcon else screen.unselectedIcon,
                                    contentDescription = screen.title
                                )
                            },
                            label = { Text(screen.title, style = MaterialTheme.typography.labelSmall) },
                            selected = selected,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.primary,
                                selectedTextColor = MaterialTheme.colorScheme.primary,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                indicatorColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) { HomeScreen(navController = navController, onMenuClick = { scope.launch { drawerState.open() } }) }
            composable(Screen.Funds.route) { FundsScreen(navController = navController) }
            composable(Screen.Portfolio.route) {
                PortfolioScreen(
                    onNavigateToAuth = { navController.navigate("auth?mode=signin") { launchSingleTop = true } },
                    onNavigateToFund = { schemeCode, fundName ->
                        val encodedName = java.net.URLEncoder.encode(fundName, "UTF-8")
                        navController.navigate("fund_detail/$schemeCode/$encodedName")
                    },
                    onNavigateToCASImport = { navController.navigate("cas_import") { launchSingleTop = true } }
                )
            }
            composable(Screen.Markets.route) { MarketsScreen(navController = navController) }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onNavigateToAuth = { navController.navigate("auth?mode=signin") { launchSingleTop = true } },
                    onNavigateToSignUp = { navController.navigate("auth?mode=signup") { launchSingleTop = true } },
                    onExternalNavigate = { route -> navController.navigate(route) { launchSingleTop = true } }
                )
            }
            composable(Screen.FuelPrices.route) { FuelPriceScreen(onBack = { navController.popBackStack() }) }

            // See All screens
            composable(Screen.AllMarkets.route) {
                AllMarketsScreen(
                    onBack = { navController.popBackStack() },
                    onIndexClick = { symbol, name ->
                        val encodedName = java.net.URLEncoder.encode(name, "UTF-8")
                        navController.navigate("index_detail/$symbol/$encodedName")
                    }
                )
            }
            composable(Screen.AllHeadlines.route) { AllHeadlinesScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.AllEvents.route) { AllEventsScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.AllCurrencies.route) { AllCurrenciesScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.AllCommodities.route) { AllCommoditiesScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.AllNFOs.route) { AllNFOsScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.Premium.route) { PremiumScreen(onBack = { navController.popBackStack() }) }
            composable(Screen.Expenses.route) { ExpensesScreen(onBack = { navController.popBackStack() }) }

            // Calculators
            composable(Screen.Calculators.route) {
                CalculatorsScreen(
                    onBack = { navController.popBackStack() },
                    onNavigate = { route -> navController.navigate(route) { launchSingleTop = true } }
                )
            }
            composable("calc/sip") { SIPCalculatorScreen(onBack = { navController.popBackStack() }) }
            composable("calc/lumpsum") { LumpsumCalculatorScreen(onBack = { navController.popBackStack() }) }
            composable("calc/goal") { GoalPlannerScreen(onBack = { navController.popBackStack() }) }
            composable("calc/swp") { SWPCalculatorScreen(onBack = { navController.popBackStack() }) }
            composable("calc/stepup") { StepUpSIPCalculatorScreen(onBack = { navController.popBackStack() }) }

            // Learn
            composable(Screen.Learn.route) {
                LearnScreen(
                    onBack = { navController.popBackStack() },
                    onArticleClick = { articleId -> navController.navigate("learn/$articleId") { launchSingleTop = true } }
                )
            }
            composable(
                "learn/{articleId}",
                arguments = listOf(navArgument("articleId") { type = NavType.StringType })
            ) { backStackEntry ->
                LearnArticleScreen(
                    articleId = backStackEntry.arguments?.getString("articleId") ?: "",
                    onBack = { navController.popBackStack() }
                )
            }

            // Article Viewer
            composable(
                "article_viewer/{url}/{title}/{source}",
                arguments = listOf(
                    navArgument("url") { type = NavType.StringType },
                    navArgument("title") { type = NavType.StringType },
                    navArgument("source") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                ArticleViewerScreen(
                    url = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("url") ?: "", "UTF-8"),
                    title = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("title") ?: "", "UTF-8"),
                    source = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("source") ?: "", "UTF-8"),
                    onBack = { navController.popBackStack() }
                )
            }

            // CAS Import
            composable(Screen.CASImport.route) {
                CASImportScreen(
                    onBack = { navController.popBackStack() },
                    onNavigateToFund = { schemeCode, fundName ->
                        val encodedName = java.net.URLEncoder.encode(fundName, "UTF-8")
                        navController.navigate("fund_detail/$schemeCode/$encodedName")
                    }
                )
            }

            // Analytics
            composable(Screen.Analytics.route) {
                AnalyticsScreen(onBack = { navController.popBackStack() })
            }

            // Goals
            composable(Screen.Goals.route) {
                GoalsScreen(
                    onNavigateToAuth = { navController.navigate("auth?mode=signin") { launchSingleTop = true } },
                    onNavigateToCreateGoal = { navController.navigate(Screen.CreateGoal.route) { launchSingleTop = true } },
                    onNavigateToGoalDetail = { goalId -> navController.navigate("goal_detail/$goalId") { launchSingleTop = true } }
                )
            }
            composable(Screen.CreateGoal.route) {
                CreateGoalScreen(
                    onBack = { navController.popBackStack() },
                    onCreated = { /* will pop back to goals list */ }
                )
            }
            composable(
                "goal_detail/{goalId}",
                arguments = listOf(navArgument("goalId") { type = NavType.StringType })
            ) { backStackEntry ->
                GoalDetailScreen(
                    goalId = backStackEntry.arguments?.getString("goalId") ?: "",
                    onBack = { navController.popBackStack() }
                )
            }

            // Auth
            composable(
                "auth?mode={mode}",
                arguments = listOf(navArgument("mode") { type = NavType.StringType; defaultValue = "signin" })
            ) { backStackEntry ->
                val mode = backStackEntry.arguments?.getString("mode") ?: "signin"
                if (authService != null) {
                    AuthScreen(
                        authService = authService,
                        initialMode = mode,
                        onBack = { navController.popBackStack() },
                        onSuccess = { navController.popBackStack() }
                    )
                }
            }

            // Detail screens
            composable(
                "index_detail/{symbol}/{name}",
                arguments = listOf(
                    navArgument("symbol") { type = NavType.StringType },
                    navArgument("name") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                IndexDetailScreen(
                    symbol = backStackEntry.arguments?.getString("symbol") ?: "",
                    name = backStackEntry.arguments?.getString("name") ?: "",
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                "fund_detail/{schemeCode}/{fundName}",
                arguments = listOf(
                    navArgument("schemeCode") { type = NavType.StringType },
                    navArgument("fundName") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                FundDetailScreen(
                    schemeCode = backStackEntry.arguments?.getString("schemeCode") ?: "",
                    fundName = backStackEntry.arguments?.getString("fundName") ?: "",
                    onBack = { navController.popBackStack() },
                    onNavigateToAuth = { navController.navigate("auth?mode=signin") { launchSingleTop = true } }
                )
            }
        }
    }
    } // end ModalNavigationDrawer
}
